# Vscode Google Translate

[![Licence](https://img.shields.io/github/license/funkyremi/vscode-google-translate.svg)](https://github.com/funkyremi/vscode-google-translate)
![VS Code Marketplace](https://vsmarketplacebadge.apphb.com/version-short/funkyremi.vscode-google-translate.svg) ![Rating](https://vsmarketplacebadge.apphb.com/rating-short/funkyremi.vscode-google-translate.svg)

Quickly translate text right in your code 🚀

![Demo](demo.gif)

## Usage

### Translate selected text

1. Select some text to translate
1. Press `ALT+SHIFT+T`
1. Select the output languages you want and enjoy 👍

### Translate a line under cursor

This feature inserts a newline under the current one with translation

1. Set cursor/cursors on line(s) to translate
1. Select menu 'Translate line(s) under the cursor'
1. Select the output languages you want and enjoy

## Keyboard shortcut

If the keyboard shortcut doesn't work for you, you have two options:

* Open the command palette and manually select 'Translate selection(s)'
* Open your keyboard shortcuts, search for 'Translate selection(s)' and set a new shortcut for this command.

## Preferred language settings

Want to quickly translate into a specific language?
Here's how to set your preferred language to Japanese.

1. Get your preferred language code from [the web](https://www.w3schools.com/tags/ref_language_codes.asp).
1. Add the following setting to your workspace: `"vscodeGoogleTranslate.preferredLanguage": "ja"`
1. Open the command palette and select "Translate selection(s) to preferred language".

## Proxy Support

You can use a proxy to translate text with the following settings:

```js
"vscodeGoogleTranslate.host": "120.0.0.1"       // Proxy disabled if empty
"vscodeGoogleTranslate.port": "8080"            // Proxy port
"vscodeGoogleTranslate.username": "admin"       // Proxy auth disabled if empty
"vscodeGoogleTranslate.password": "password"    // Proxy password
```

## Pull request

Pull request are welcome. Fork the project, clone it, install dependencies `npm i` and start coding :-).

## Give five stars 🤩

If you like it, [rate it](https://marketplace.visualstudio.com/items?itemName=funkyremi.vscode-google-translate&ssr=false#review-details)
