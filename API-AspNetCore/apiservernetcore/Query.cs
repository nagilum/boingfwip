using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json;

namespace apiservernetcore {
    public class Query {
        /// <summary>
        /// Handle the incoming request.
        /// </summary>
        public static async Task Request(HttpContext ctx) {
            const long maxContentLength = 1024 * 10;

            if (ctx.Request.ContentLength.HasValue &&
                ctx.Request.ContentLength.Value > maxContentLength) {

                ctx.Response.Clear();
                ctx.Response.StatusCode = 413;

                return;
            }

            var obj = new Wrapper {
                // Request
                request = new Dictionary<string, string> {
                    { "method", ctx.Request.Method },
                    { "path", ctx.Request.Path },
                    { "protocol", ctx.Request.Protocol }
                }
            };

            // Connection
            var ip = ctx.Request.Headers.ContainsKey("x-forwarded-for")
                ? ctx.Request.Headers["x-forwarded-for"].ToString()
                : ctx.Connection.RemoteIpAddress.ToString();

            obj.request.Add("ip", ip);

            // Headers
            if (ctx.Request.Headers.Keys.Any()) {
                obj.headers = new Dictionary<string, string>();

                foreach (var key in ctx.Request.Headers.Keys) {
                    obj.headers.Add(key, ctx.Request.Headers[key]);
                }
            }

            // Cookies
            if (ctx.Request.Cookies.Keys.Any()) {
                obj.cookies = new Dictionary<string, string>();

                foreach (var key in ctx.Request.Cookies.Keys) {
                    obj.cookies.Add(key, ctx.Request.Cookies[key]);
                }
            }

            // Query
            if (ctx.Request.Query.Keys.Any()) {
                obj.query = new Dictionary<string, string>();

                foreach (var key in ctx.Request.Query.Keys) {
                    obj.query.Add(key, ctx.Request.Query[key]);
                }
            }

            // Body
            var raw = new StreamReader(ctx.Request.Body)
                .ReadToEnd();

            if (raw.Length > maxContentLength) {
                ctx.Response.Clear();
                ctx.Response.StatusCode = 413;

                return;
            }

            AnalyzeAndParseBody(raw, obj);

            // Done
            ctx.Response.Clear();
            ctx.Response.ContentType = "application/json; charset=utf-8";

            // Handle CORS.
            HandleCors(ctx);

            // Write the object out.
            await ctx.Response.WriteAsync(
                JsonConvert.SerializeObject(obj));
        }

        /// <summary>
        /// Analyze and parse the body.
        /// </summary>
        private static void AnalyzeAndParseBody(string raw, Wrapper obj) {
            if (string.IsNullOrWhiteSpace(raw)) {
                return;
            }

            obj.body = new Dictionary<string, object> {
                { "raw", raw }
            };

            var ct = obj.headers["Content-Type"]
                     ?? obj.headers["content-type"];

            if (string.IsNullOrWhiteSpace(ct)) {
                return;
            }

            var cti = ct.IndexOf(';');
            var ctp = ct
                .Split(';')
                .Select(n => n.Trim());

            if (cti > -1) {
                ct = ct.Substring(0, cti);
            }

            Dictionary<string, string> dict;

            switch (ct.ToLower()) {
                // JSON
                case "application/json":
                    obj.body.Add("json", JsonConvert.DeserializeObject(raw));
                    break;

                // Form
                case "multipart/form-data":
                    dict = ParseMultipartFormData(ctp, raw);

                    if (dict != null) {
                        obj.body.Add("form", dict);
                    }

                    break;

                // Form
                case "application/x-www-form-urlencoded":
                    try {
                        dict = raw
                            .Split('&')
                            .Select(part => part.Split('='))
                            .Where(kvs => kvs.Length == 2)
                            .ToDictionary(kvs => kvs[0], kvs => kvs[1]);

                        obj.body.Add("form", dict);
                    }
                    catch {
                        //
                    }
                    
                    break;
            }
        }

        /// <summary>
        /// Parse the raw data and split with the posted boundary.
        /// </summary>
        private static Dictionary<string, string> ParseMultipartFormData(IEnumerable<string> ctp, string raw) {
            var boundary = (
                from temp in ctp
                where temp.StartsWith("boundary")
                select temp.Substring(temp.IndexOf('=') + 1)
            ).FirstOrDefault();

            if (string.IsNullOrWhiteSpace(boundary)) {
                return null;
            }

            var parts = raw.Split(boundary);
            var dict = new Dictionary<string, string>();

            foreach (var part in parts) {
                var index = part.IndexOf(';');

                if (index == -1) {
                    continue;
                }

                var kv = part
                    .Substring(index + 1)
                    .Trim();

                var kvs = kv.Split("\r\n\r\n");

                if (kvs.Length != 2) {
                    continue;
                }

                var key = kvs[0];
                var value = kvs[1];

                if (key.StartsWith("name=\"") &&
                    key.EndsWith("\"")) {

                    key = key.Substring(6, key.Length - 7);
                }

                if (value.EndsWith("\r\n--")) {
                    value = value.Substring(0, value.Length - 4);
                }

                dict.Add(key, value);
            }

            return dict;
        }

        /// <summary>
        /// Handle CORS headers if it's an OPTIONS call.
        /// </summary>
        private static void HandleCors(HttpContext ctx) {
            if (ctx.Request.Method != "OPTIONS") {
                return;
            }

            // Method
            if (ctx.Request.Headers.ContainsKey("Access-Control-Request-Method")) {
                ctx.Response.Headers.Add(
                    "Access-Control-Allow-Methods",
                    ctx.Request.Headers["Access-Control-Request-Method"]);
            }

            // Headers
            if (ctx.Request.Headers.ContainsKey("Access-Control-Request-Headers")) {
                var headers = ctx.Request.Headers["Access-Control-Request-Headers"]
                    .ToString()
                    .Split(',')
                    .Select(n => n.Trim());

                ctx.Response.Headers.Add(
                    "Access-Control-Allow-Headers",
                    string.Join(",", headers));
            }

            // Origin
            var origin = (ctx.Request.Headers.ContainsKey("Origin")
                             ? ctx.Request.Headers["Origin"].ToString()
                             : null)
                         ?? (ctx.Request.Headers.ContainsKey("origin")
                             ? ctx.Request.Headers["origin"].ToString()
                             : null)
                         ?? "*";

            ctx.Response.Headers.Add("Access-Control-Allow-Origin", origin);
        }
    }

    public class Wrapper {
        public Dictionary<string, string> request { get; set; }
        public Dictionary<string, string> headers { get; set; }
        public Dictionary<string, string> cookies { get; set; }
        public Dictionary<string, string> query { get; set; }
        public Dictionary<string, object> body { get; set; }
    }
}