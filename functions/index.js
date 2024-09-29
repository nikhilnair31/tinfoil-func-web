/**
    * Import function triggers from their respective submodules:
    *
    * const {onCall} = require("firebase-functions/v2/https");
    * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
    *
    * See a full list of supported triggers at https://firebase.google.com/docs/functions
*/

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

const {onRequest} = require("firebase-functions/v2/https");
const functions = require('firebase-functions')
const logger = require("firebase-functions/logger");
const OpenAI = require('openai');

const config = functions.config()
const openai = new OpenAI({ 
    apiKey:  config.openai_api_key
});

const modelName = `gpt-4o-mini`
const systemPrompt = `
You are to work on a fun and absurd conspiracy creator game. 
The player is to be presented with a list of things like notes, news snippets, images and location markers. 
They can then connect them in any order with some relationship between the connections. 
This final conspiracy is to be judged and scored to rank the player on a global leaderboard. 
You now have to stitch together the multiple connected clues into a single cohesive conspiracy.
`;
const temp = 0.3
const max_tok = 4096

// exports.helloWorld = onRequest((request, response) => {
//     logger.info("Hello logs!", {structuredData: true});
//     response.send("Hello from Firebase!");
// });

exports.callOpenaiApi = onRequest(async (request, response) => {
    const prompt = request.query.text;
    if (prompt.length == 0) {
        response.status(400).send("Missing prompt");
    }
    else {
        logger.info(`Prompt: ${prompt}`);
    }
    
    const completion = await openai.chat.completions.create({
        model: modelName,
        messages: [
            {
                "role": "system", 
                "content": systemPrompt
            },
            {
                "role": "user", 
                "content": prompt
            }
        ],
        temperature: temp,
        max_completion_tokens: max_tok
    });
    logger.info(`Choice: ${completion.choices[0]}`);

    response.send(completion.choices[0]);
});