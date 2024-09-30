//#region Imports
const { onCall } = require("firebase-functions/v2/https");
const { info, error } = require("firebase-functions/logger");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString} = require('firebase-functions/params');
const admin = require("firebase-admin");
const OpenAI = require('openai');

admin.initializeApp();
//#endregion

//#region Scoring

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
            model: defineString('MODELNAME_SCORING').value(),
            messages: [
                {
                    "role": "system", 
                    "content": defineString('SYSTEMPROMPT_SCORING').value()
                },
                {
                    "role": "user", 
                    "content": userPrompt_scoring
                }
            ],
            temperature: Number.parseFloat(defineString('TEMP_SCORING').value()),
            max_completion_tokens: Number.parseFloat(defineString('MAX_TOK_SCORING').value())
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

//#region Gen

exports.callGen = onSchedule("every 1 minutes", async (event) => {
    // Call OpenAI API
    const openai = new OpenAI({ 
        apiKey:  defineString('OPENAI_API_KEY').value()
    });
    const result_gen = await openai.chat.completions.create({
        model: defineString('MODELNAME_GEN').value(),
        messages: [
            {
                "role": "system", 
                "content": defineString('SYSTEMPROMPT_GEN').value()
            },
            {
                "role": "user", 
                "content": defineString('USERPROMPT_GEN').value()
            }
        ],
        temperature: Number.parseFloat(defineString('TEMP_GEN').value()),
        max_completion_tokens: Number.parseFloat(defineString('MAX_TOK_GEN').value()),
        response_format: {
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
            const img_gen = await openai.images.generate({
                model: defineString('IMGMODELNAME_GEN').value(),
                size: defineString('IMG_SIZE').value(),
                prompt: clue_content,
                n: 1
            });
            info(`Img Gen Result: ${img_gen}`);

            // Assuming OpenAI returns URL, not base64 content.
            const img_url = img_gen.data[0].url;
            info(`Img URL: ${img_url}`);

            // Fetch image from URL and convert to buffer
            const fileContent = await fetch(img_url)
            const buffer = await fileContent.arrayBuffer()
            const imageBuffer = Buffer.from(buffer)
            const imgPath = `clues/${Date.now()}.png`;
            info(`imgPath: ${imgPath}`);
            await admin.storage().bucket().file(imgPath).save(imageBuffer, {
                contentType: 'image/png',
                metadata: {
                    contentType: 'image/png'
                }
            });

            clue.image_url = imgPath;
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