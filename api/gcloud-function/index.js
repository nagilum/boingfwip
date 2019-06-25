'use strict';

/**
 * Receive a request and reply with a JSON object with info and content from the request.
 * 
 * @param {Object} req Cloud Function request context.
 * @param {Object} res Cloud Function response context.
 */
exports.boingfwip = (req, res) => {
    let obj = {
        http: {
            version: req.httpVersion,
            major: req.httpVersionMajor,
            minor: req.httpVersionMinor,
            method: req.method
        },
        connection: {
            remoteAddress: req.connection.remoteAddress
        },
        headers: req.headers,
        query: req.query,
        body: null
    };

    try {
        // x-forwarded-for
        if (req.headers['x-forwarded-for']) {
            obj.connection.xForwardedFor = req.headers['x-forwarded-for'];
        }

        // Body.
        if (req.rawBody) {
            obj.body = {
                raw: req.rawBody,
                stringified: req.rawBody.toString()
            };
    
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
    
                            let entries = obj.body.stringified.split(boundary);
    
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
    
                        let entries = obj.body.stringified.split('&');
    
                        if (entries.length > 0) {
                            entries.forEach((entry) => {
                                let entrySplit = entry.split('=');

                                if (entrySplit.length === 2) {
                                    obj.body.form[entrySplit[0]] = entrySplit[1];
                                }
                            });
                        }
    
                        break;
    
                    case 'application/json':
                    case 'application/javascript':
                        obj.body.json = JSON.parse(obj.body.stringified);
                        break;
                }
            }
        }
    }
    catch (ex) {
        obj.body.ex = ex;
    }

    res.json(obj);
};