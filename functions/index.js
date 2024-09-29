const { onCall } = require("firebase-functions/v2/https");
const { defineString } = require('firebase-functions/params');
const OpenAI = require('openai');
const { info, error } = require("firebase-functions/logger");

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

exports.callScoring = onCall(async (request) => {
    info("request: ", request);
    info("request.data: ", request.data);
    info("request.data.text: ", request.data.text);
    // info("request.auth.uid: ", request.auth.uid);

    // Validate input
    const userPrompt_scoring = request.data.text;
    if (!userPrompt_scoring || userPrompt_scoring.length === 0) {
        throw new HttpsError(
            "invalid-argument", 
            "idk"
        );
    }
    info(`User Prompt: ${userPrompt_scoring}`);

    try {
        // Call OpenAI API
        const openai = new OpenAI({ 
            apiKey:  defineString('OPENAI_API_KEY').value()
        });
        const result_scoring = await openai.chat.completions.create({
            model: modelName_scoring,
            messages: [
                {
                    "role": "system", 
                    "content": systemPrompt_scoring
                },
                {
                    "role": "user", 
                    "content": userPrompt_scoring
                }
            ],
            temperature: temp_scoring,
            max_completion_tokens: max_tok_scoring
        });
        const result = result_scoring.choices[0].message.content;
        info(`Scoring Result: ${result}`);

        // Send back the result to Unity
        return {result: result};
    } 
    catch (err) {
        error("Error calling OpenAI API:", err);
        return {result: "Failed to process the data."};
    }
});