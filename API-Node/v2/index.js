'use strict';

/**
 * Create a JSON object from the incoming request and output it.
 * @param {Object} req Cloud Function request context.
 * @param {Object} res Cloud Function response context.
 * @returns {Object} Compiled JSON object.
 */
exports.query = (req, res) => {
    let origin = req.headers['origin']
        ? req.headers['origin']
        : '*';

    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Get headers.
    let excludeHeaders = [];
    let headers = {};

    for (let key in req.headers) {
        if (excludeHeaders.includes(key)) {
            continue;
        }

        headers[key] = req.headers[key];
    }

    // Compile the return object.
    let obj = {
        http: {
            version: req.httpVersion,
            major: req.httpVersionMajor,
            minor: req.httpVersionMinor,
            method: req.method
        },
        connection: {
            remoteAddress: req.headers['x-forwarded-for'] ||
                           req.connection.remoteAddress
        },
        headers: headers,
        query: req.query,
        body: {
            raw: null
        }
    };

    // Include and analyze the request body.
    try {
        if (req.rawBody) {
            obj.body.raw = req.rawBody.toString();
    
            let ct = req.headers['content-type'],
                boundary;
    
            if (ct) {
                if (ct.indexOf(';') > -1) {
                    let values = ct.split(';')
    
                    if (values.length > 0) {
                        ct = values[0];
                    }
    
                    // Check for boundary.
                    if (values.length > 1) {
                        values.forEach((value) => {
                            value = value.trim();
    
                            if (value.startsWith('boundary=')) {
                                boundary = value.substr(value.indexOf('=') + 1).trim();
                            }
                        });
                    }
                }
    
                switch (ct) {
                    case 'multipart/form-data':
                        if (boundary) {
                            obj.body.form = {};
    
                            let entries = obj.body.raw.split(boundary);
    
                            if (entries.length > 0) {
                                entries.forEach((entry) => {
                                    if (entry === '--') {
                                        return;
                                    }
    
                                    if (entry.startsWith('\r\n')) {
                                        entry = entry.substr(2);
                                    }
    
                                    if (entry.endsWith('\r\n')) {
                                        entry = entry.substr(0, entry.length -2);
                                    }
    
                                    if (entry.indexOf('\r\n\r\n') === -1) {
                                        return;
                                    }
    
                                    let key = entry.substr(0, entry.indexOf('\r\n\r\n')),
                                        value = entry.substr(entry.indexOf('\r\n\r\n') +4),
                                        keys = key.split(';');
    
                                    key = null;
    
                                    if (keys.length > 0) {
                                        keys.forEach((k) => {
                                            k = k.trim();
    
                                            if (k.startsWith('name=')) {
                                                key = k.substr(5);
    
                                                if (key.startsWith('"')) {
                                                    key = key.substr(1);
                                                }
    
                                                if (key.endsWith('"')) {
                                                    key = key.substr(0, key.length -1);
                                                }
                                            }
                                        });
                                    }
    
                                    if (value.endsWith('\r\n--')) {
                                        value = value.substr(0, value.length -4);
                                    }
    
                                    obj.body.form[key] = value;
                                });
                            }
                        }
    
                        break;
    
                    case 'application/x-www-form-urlencoded':
                        obj.body.form = {};
    
                        let entries = obj.body.raw.split('&');
    
                        if (entries.length > 0) {
                            entries.forEach((entry) => {
                                let iof = entry.indexOf('=');
    
                                if (iof === -1) {
                                    return;
                                }
    
                                let key = entry.substr(0, iof),
                                    value = entry.substr(iof + 1);
    
                                obj.body.form[key] = value;
                            });
                        }
    
                        break;
    
                    case 'application/json':
                    case 'application/javascript':
                        obj.body.json = JSON.parse(obj.body.raw);
                        break;
                }
            }
        }
    }
    catch (ex) {
        // Do nothing.
    }

    // Done.
    res.json(obj);
};