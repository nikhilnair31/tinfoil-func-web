//#region Imports
const { onCall } = require("firebase-functions/v2/https");
const { info, error } = require("firebase-functions/logger");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString } = require('firebase-functions/params');
const admin = require("firebase-admin");
const OpenAI = require('openai');

admin.initializeApp();
//#endregion

//#region Scoring Related

// Parameters
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

// Function
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
//#endregion

//#region Gen Related

// Parameters
const modelName_gen = `gpt-4o-mini`
const systemPrompt_gen = `
You are to work on a political conspiracy creator game. The player is to be presented with a list of things like notes, news snippets, images and real world location markers. 
They can then connect them in any order with some relationship between the connections. This final conspiracy is to be judged and scored to rank the player on a global leaderboard.
`;
const userPrompt_gen = `
Create 5 of each clue_type
`;
const temp_gen = 1
const max_tok_gen = 2048
const response_format = {
    "type": "json_schema",
    "json_schema": {
    "name": "clue_data",
    "strict": true,
    "schema": {
        "type": "object",
        "properties": {
        "all_data": {
            "type": "array",
            "items": {
            "type": "object",
            "properties": {
                "clue_type": {
                    "type": "string"
                },
                "clue_content": {
                    "type": "string"
                }
            },
            "required": [
                "clue_type",
                "clue_content"
            ],
            "additionalProperties": false
            }
        }
        },
        "additionalProperties": false,
        "required": [
            "all_data"
        ]
    }
    }
}
var num_of_itr = 1

// Function
exports.callGen = onSchedule("every 24 hours", async (event) => {
    // Call OpenAI API
    const openai = new OpenAI({ 
        apiKey:  defineString('OPENAI_API_KEY').value()
    });
    const result_gen = await openai.chat.completions.create({
        model: modelName_gen,
        messages: [
            {
                "role": "system", 
                "content": systemPrompt_gen
            },
            {
                "role": "user", 
                "content": userPrompt_gen
            }
        ],
        temperature: temp_gen,
        max_completion_tokens: max_tok_gen,
        response_format: response_format
    });
    const result = result_gen.choices[0].message.content;
    info(`Gen Result: ${result}`);

    const data = JSON.parse(result);
    info(`Data loaded: ${JSON.stringify(data)}`);
    for (let idx = 0; idx < data.all_data.length; idx++) {
        const clue = data.all_data[idx];
        const clue_type = clue.clue_type;
        const clue_content = clue.clue_content;
        info(`Clue ${idx + 1}: ${clue_type} - ${clue_content}`);

        if (clue_type.toLowerCase() === "image") {
            const response = await generateImage(clue_content); // Assuming generateImage is defined to call OpenAI API
            const b64_json = response.data.data[0].b64_json;
            clue.b64_json = b64_json;
            info(`Image b64_json: ${b64_json.slice(0, 10)}`);
        }

        // Push data to Firebase
        admin.database().ref('/test')
        .push(clue)
        .then(() => {
            info("Pushed data");
        })
        .catch((err) => {
            info(`err: ${err}`);
            throw new HttpsError("unknown", err.message, err);
        })
    }
});
//#endregion