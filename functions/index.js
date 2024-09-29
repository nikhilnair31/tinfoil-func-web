const {onRequest} = require("firebase-functions/v2/https");
const functions = require('firebase-functions')
const logger = require("firebase-functions/logger");
const OpenAI = require('openai');

const config = functions.config()
const openai = new OpenAI({ 
    apiKey:  config.openai_api_key
});

// Scoring parameters
const modelName_scoring = `gpt-4o-mini`
const systemPrompt_scoring = `
You are to work on a fun and absurd conspiracy creator game. 
The player is to be presented with a list of things like notes, news snippets, images and location markers. 
They can then connect them in any order with some relationship between the connections. 
This final conspiracy is to be judged and scored to rank the player on a global leaderboard. 
You now have to stitch together the multiple connected clues into a single cohesive conspiracy.
`;
const temp_scoring = 0.3
const max_tok_scoring = 4096

async function CallOpenaiApi(modelName, systemPrompt, userPrompt, temp, max_tok) {
    const completion = await openai.chat.completions.create({
        model: modelName,
        messages: [
            {
                "role": "system", 
                "content": systemPrompt
            },
            {
                "role": "user", 
                "content": userPrompt
            }
        ],
        temperature: temp,
        max_completion_tokens: max_tok
    });
    logger.info(`CallOpenaiApi Choice: ${completion.choices[0]}`);

    return completion.choices[0];
}

exports.callScoring = functions.https.onRequest(async (request, response) => {
    const prompt = request.query.text;
    if (prompt.length == 0) {
        response.status(400).send("Missing prompt");
    }
    else {
        logger.info(`Prompt: ${prompt}`);
    }
    
    const completion_scoring = await CallOpenaiApi(
        modelName_scoring, 
        systemPrompt_scoring, 
        prompt_scoring, 
        temp_scoring, 
        max_tok_scoring
    );
    const result_scoring = completion_scoring.choices[0].content;
    logger.info(`Scoring Result: ${result_scoring}`);

    response.send(result_scoring);
});