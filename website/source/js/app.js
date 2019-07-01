"use strict";

/**
 * Syntax highlight the JSON output.
 * @param {String} json Input JSON.
 * @returns {String} Highlighted JSON.
 */
let syntaxHighlight = (json) => {
    if (typeof json != 'string') {
        json = JSON.stringify(json, undefined, 2);
    }

    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'number';

        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            }
            else {
                cls = 'string';
            }
        }
        else if (/true|false/.test(match)) {
            cls = 'boolean';
        }
        else if (/null/.test(match)) {
            cls = 'null';
        }

        return '<span class="' + cls + '">' + match + '</span>';
    });
};

/**
 * Execute a GET towards https://api.boingfwip.net/.
 * @param {Event} e Click event.
 * @returns {Promise} Fetch API promise.
 */
let tryItExecute = (e) => {
    console.log('');
    console.log('Boingfwip Test');
    console.log('==============');
    console.log('GET https://api.boingfwip.net/');

    return fetch(
        'https://api.boingfwip.net/',
        {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache'
        })
        .then((res) => {
            if (res.status !== 200) {
                throw new Error(res.statusText);
            }

            return res.json();
        })
        .then((data) => {
            console.log('Response from API:');
            console.log('Response Body', data);
        })
        .catch((err) => {
            console.log('Error while executing fetch()');
            console.error(err);
        });
};

/**
 * Init all the things..
 */
(() => {
    // Prettify JSON.
    document
        .querySelectorAll('pre.json-beautify')
        .forEach((pre) => {
            let html = syntaxHighlight(
                JSON.parse(pre.innerText))
                .replace(new RegExp(':', 'g'), '<span class="default">:</span>');

            pre.innerHTML = html;
        });

    // Try-it buttons.
    document
        .querySelectorAll('button')
        .forEach((button) => {
            button.addEventListener('click', tryItExecute);
        });
})();