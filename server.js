
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(express.json());

// Initialisation de l'API Gemini avec la clé du fichier .env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Jeton secret pour l'authentification du Webhook Meta
const MY_VERIFY_TOKEN = "mon_jeton_secret_123";

// Tokens et identifiants récupérés depuis les variables d'environnement Render
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// 1. Route de vérification (GET) - Utilisée par Meta pour valider le webhook
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === MY_VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// 2. Route de réception des messages (POST) - Utilisée par Meta pour envoyer les messages WhatsApp
app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
        try {
            const entry = body.entry[0];
            const changes = entry.changes[0];
            const value = changes.value;

            if (value && value.messages && value.messages.length > 0) {
                const message = value.messages[0];
                const senderID = message.from; // Numéro de l'expéditeur
                const messageText = message.text ? message.text.body : '';

                console.log(`Message reçu de ${senderID}: ${messageText}`);

                if (messageText) {
                    // Instructions système pour donner la personnalité de Stela
                    const systemInstruction = "Tu es stela, un assistant virtuel intelligent. Tu réponds aux messages WhatsApp de manière naturelle, polie et contextuelle, en te comportant comme l'assistant d'une étudiante ou d'un ingénieure logiciel à l'IUT de Douala.";

                    // Appel à l'API Gemini pour générer une réponse
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: messageText,
                        config: {
                            systemInstruction: systemInstruction,
                        }
                    });

                    const replyText = response.text || "Désolé, je n'ai pas pu comprendre votre demande.";

                    // Envoi de la réponse sur WhatsApp via l'API Meta
                    await axios.post(
                        https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages,
                        {
                            messaging_product: 'whatsapp',
                            to: senderID,
                            text: { body: replyText },
                        },
                        {
                            headers: {
                                Authorization: Bearer ${WHATSAPP_TOKEN},
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    console.log(`Réponse envoyée à ${senderID}: ${replyText}`);
                }
            }
            res.sendStatus(200);
        } catch (error) {
            console.error('Erreur lors du traitement du webhook :', error.response?.data || error.message);
            res.sendStatus(500);
        }
    } else {
        res.sendStatus(404);
    }
});

// Écoute du serveur sur le port fourni par Render ou 10000 par défaut
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Serveur stela en cours d'exécution sur le port ${PORT}`);
    
});
