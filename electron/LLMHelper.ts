import OpenAI from "openai";
import fs from "fs";
import { ChatCompletionContentPartImage } from "openai/resources/chat";

export class LLMHelper {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.openai = new OpenAI({ apiKey });
    this.model = model;
  }

  private async fileToBase64(imagePath: string) {
    const imageData = await fs.promises.readFile(imagePath);
    return imageData.toString("base64");
  }

  private cleanJsonResponse(text: string): string {
    text = text.replace(/^```(?:json)?\n/, "").replace(/\n```$/, "");
    return text.trim();
  }

  public async extractProblemFromImages(imagePaths: string[]) {
    try {
      const imageParts = await Promise.all(
        imagePaths.map((path) => this.fileToBase64(path))
      );

      const prompt = `You are a coding problem analyzer. Please analyze these images of a coding problem and extract the following information in JSON format:
      {
        "problem_statement": "The complete problem statement",
        "input_format": {
          "description": "Description of input format",
          "parameters": [{"name": "param name", "type": "param type", "description": "param description"}]
        },
        "output_format": {
          "description": "Description of what should be output",
          "type": "The expected type of the output"
        },
        "constraints": [
          {"description": "Each constraint in plain text"}
        ],
        "test_cases": [
          {
            "input": "Example input",
            "output": "Expected output",
            "explanation": "Explanation if provided"
          }
        ]
      }
      Important: Return ONLY the JSON object, without any markdown formatting or code blocks.`;

      let imageLists = imageParts.map((image) => {
        let img: ChatCompletionContentPartImage = {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${image}`,
          },
        };
        return img;
      });
      const result = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are a helpful AI assistant.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              ...imageLists,
            ],
          },
        ],
        max_tokens: 1000,
      });

      const text = this.cleanJsonResponse(result.choices[0].message.content);
      return JSON.parse(text);
    } catch (error) {
      console.error("Error extracting problem from images:", error);
      throw error;
    }
  }

  public async generateSolution(problemInfo: any) {
    const prompt = `Given this coding problem:
    ${JSON.stringify(problemInfo, null, 2)}
    
    Please provide a solution in the following JSON format:
    {
      "solution": {
        "explanation": "Detailed explanation of the approach",
        "complexity": {
          "time": "Time complexity",
          "space": "Space complexity"
        },
        "code": "The complete solution code",
        "test_results": [
          {
            "input": "test case input",
            "expected": "expected output",
            "actual": "actual output",
            "passed": true/false
          }
        ]
      }
    }
    Important: Return ONLY the JSON object, without any markdown formatting or code blocks.`;

    const result = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
    });

    const text = this.cleanJsonResponse(result.choices[0].message.content);
    return JSON.parse(text);
  }

  public async debugSolutionWithImages(
    problemInfo: any,
    currentCode: string,
    debugImagePaths: string[]
  ) {
    try {
      const imageParts = await Promise.all(
        debugImagePaths.map((path) => this.fileToBase64(path))
      );

      const prompt = `You are a coding problem debugger. Given:
      1. The original problem: ${JSON.stringify(problemInfo, null, 2)}
      2. The current solution: ${currentCode}
      3. The debug information in the provided images
      
      Please analyze the debug information and provide feedback in this JSON format:
      {
        "analysis": {
          "issues_found": [
            {
              "description": "Description of the issue",
              "location": "Where in the code",
              "severity": "high/medium/low"
            }
          ],
          "suggested_fixes": [
            {
              "description": "Description of the fix",
              "code_change": "The specific code change needed"
            }
          ]
        },
        "improved_solution": {
          "code": "The complete improved solution",
          "explanation": "Explanation of the changes made"
        }
      }
      Important: Return ONLY the JSON object, without any markdown formatting or code blocks.`;

      let imageLists = imageParts.map((image) => {
        let img: ChatCompletionContentPartImage = {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${image}`,
          },
        };
        return img;
      });

      const result = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are a helpful AI assistant.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              ...imageLists,
            ],
          },
        ],
        max_tokens: 2000,
      });

      const text = this.cleanJsonResponse(result.choices[0].message.content);
      return JSON.parse(text);
    } catch (error) {
      console.error("Error debugging solution with images:", error);
      throw error;
    }
  }
}
