// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { Configuration, OpenAIApi } from "openai";
import { marked } from "marked";
import { langs } from "./languages";

const setApiKey = vscode.commands.registerCommand(
  "code-guide.setOpenAIKey",
  () => {
    const currentApiKey = vscode.workspace
      .getConfiguration("code-guide")
      .get("apiKey");

    vscode.window
      .showInputBox({
        value: typeof currentApiKey === "string" ? currentApiKey : "",
        placeHolder: "OpenAI API Key",
        prompt: "Enter your OpenAI API key",
      })
      .then((apiKey) => {
        if (!apiKey) {
          return;
        }
        vscode.workspace
          .getConfiguration("code-guide")
          .update("apiKey", apiKey, true);
        // success
        vscode.window.showInformationMessage("Code Guide: OpenAI API key set.");
      });
  }
);

const setLanguage = vscode.commands.registerCommand(
  "code-guide.setLanguage",
  () => {
    // select language
    vscode.window
      .showQuickPick(langs.map((lang) => ({ label: lang })))
      .then((language) => {
        if (!language) {
          return;
        }
        vscode.workspace
          .getConfiguration("code-guide")
          .update("language", language.label, true);
        // success
        vscode.window.showInformationMessage(
          `Code Guide: Language set to ${language.label}.`
        );
      });
  }
);

const configuration = new Configuration({
  apiKey: vscode.workspace.getConfiguration("code-guide").get("apiKey"),
});
const openai = new OpenAIApi(configuration);

const generateFileDescriptionPrompt = (text: string, language: string) => {
  return `\
You are a programmer helping a new programmer understand the code in this file.
Please describe the code in ${language}.

Output Format (Markdown):

# Overview, Framework, Library, or API
# Context, Background, and Motivation
# Where to start reading
# Which files to read next
# Prerequisites

Input Code:

${text}
`;
};

// describe code
const describeCode = vscode.commands.registerCommand(
  "code-guide.describeCodeInThisFile",
  () => {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Code Guide: Generating description...",
        cancellable: false,
      },
      async () => {
        // check api key
        const apiKey = vscode.workspace
          .getConfiguration("code-guide")
          .get("apiKey");
        if (!apiKey) {
          vscode.window.showErrorMessage(
            "Code Guide: Please set your OpenAI API key in the Code Guide extension settings."
          );
          return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }
        // get full content of the file
        const document = editor.document;
        const text = document.getText();
        // get the language from config (English, Chinese, etc.)
        let language = vscode.workspace
          .getConfiguration("code-guide")
          .get("language");
        if (typeof language !== "string") {
          language = "English";
        }
        // create chat completion
        try {
          const response = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "user",
                content: generateFileDescriptionPrompt(
                  text,
                  language as string
                ),
              },
            ],
          });
          const responseText = response.data.choices[0]?.message?.content;
          if (!responseText) {
            vscode.window.showErrorMessage(
              "Code Guide: Failed to generate description."
            );
            return;
          }
          // render markdown in new tab (beside the code)
          const panel = vscode.window.createWebviewPanel(
            "codeGuide",
            "Code Guide",
            vscode.ViewColumn.Beside,
            {}
          );
          panel.webview.html = marked(responseText);
        } catch (error) {
          vscode.window.showErrorMessage(
            "Code Guide: Failed to generate description."
          );
          return;
        }
      }
    );
  }
);

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(setApiKey);
  context.subscriptions.push(setLanguage);
  context.subscriptions.push(describeCode);
}

// This method is called when your extension is deactivated
export function deactivate() {}
