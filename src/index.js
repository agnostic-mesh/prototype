require("dotenv").config();

const { logger } = require("./utils/logger.js");

const { parseTSVs } = require("./utils/shortTSVParser.js");

const {
  getBuiltInComputationHelpers,
  getBuiltInIOHelpers,
} = require("./utils/builtInUtils.js");

const restana = require("restana");
const bodyParser = require("body-parser");

const service = restana({
  defaultRoute: (req, res) => res.send("", 404),
  errorHandler: (err, req, res) => {
    logger.error("handler error", { err });
    res.send(err.message, 400);
  },
});

service.use(
  bodyParser.json({
    limit: "1024mb",
  })
);

service.use((req, res, next) => {
  logger.info("req in", {
    url: req.url,
    method: req.method,
  });

  next();
});

// parse & save
// load

// TODO

const tsvDirPath = process.argv[2];

async function start() {
  try {
    const runtimeObject = await parseTSVs(tsvDirPath);

    runtimeObject.Exports.forEach((exp) => {
      service[exp.method](exp.path, async (req, res) => {
        try {
          let result = req;

          // input transformation
          for (const f of exp.input_transformation) {
            result = await f(result);
          }

          // linked functions
          for (const f of exp.functions) {
            result = await f(result);
          }

          // output transformation
          for (const f of exp.output_transformation) {
            result = await f(result);
          }

          res.send(result, 200, { "content-type": exp.output_content_type });
        } catch (err) {
          logger.error("handler error", err);

          res.send(err.message, 400);
        }
      });
    });

    await service.start(Number(process.env.EXPORT_HTTP_PORT));

    logger.info("server ignited");
  } catch (err) {
    logger.error("start", err);
  }
}

start();
