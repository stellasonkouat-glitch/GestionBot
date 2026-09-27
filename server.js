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

// Remplacez ceci par votre token permanent Meta Cloud API et votre ID de numéro de téléphone
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

// 2. Route de réception des messages (POST) - Reçoit les messages WhatsApp et répond via Gemini
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;

        if (body.object === 'whatsapp_business_account') {
            for (const entry of body.entry) {
                for (const change of entry.changes) {
                    const value = change.value;
                    if (value && value.messages && value.messages.length > 0) {
                        const message = value.messages[0];
                        const from = message.from; // Numéro de l'expéditeur
                        const msgBody = message.text ? message.text.body : null;

                        if (msgBody) {
                            console.log(`Message reçu de ${from} : ${msgBody}`);

                            // Instructions système pour donner la personnalité de stela (IUT de Douala / Ingénieur logiciel)
                            const systemInstruction = "Tu es stela, un assistant virtuel intelligent. Tu réponds aux messages WhatsApp de manière naturelle, polie et contextuelle, en te comportant comme l'assistant d'une étudiante ou d'un ingénieure logiciel à l'IUT de Douala.";

                            // Appel à l'API Gemini (gemini-2.5-flash)
                            const response = await ai.models.generateContent({
                                model: 'gemini-2.5-flash',
                                contents: msgBody,
                                config: {
                                    systemInstruction: systemInstruction,
                                }
                            });

                            const replyText = response.text || "Désolé, je n'ai pas pu comprendre votre demande.";

                            // Envoi de la réponse sur WhatsApp via l'API Meta
                            await axios.post(`
                                https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
                                {
                                    messaging_product: 'whatsapp',
                                    to: from,
                                    text: { body: replyText },
                                },
                                {
                                    headers: {
                                        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                                        'Content-Type': 'application/json',
                                    },
                                }
                            );

                            console.log(`Réponse envoyée à ${from} : ${replyText}`);
                        }
                    }
                }
            }
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('Erreur lors du traitement du webhook :', error.response?.data || error.message);
        res.sendStatus(500);
    }
});

// Écoute du serveur sur le port 3000 (ou celui de l'hébergeur)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur stela en cours d'exécution sur le port ${PORT}`);
});
