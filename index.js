import { pathToFileURL } from "node:url";
import Fastify from "fastify";

export async function proxy(request, reply) {
  reply.log = reply.log.child({
    ip: request.ip || "missing IP",
    ips: request.ips || false,
    headers: request.headers,
  });
  return reply.status(200).send("hi");
}

async function main() {
  const logger = {
    development: {
      transport: {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
          colorize: true,
          useLevel: "debug",
        },
      },
    },
    production: true,
    test: false,
  };

  if (!process.env.NODE_ENV) {
    throw new Error("NODE_ENV must be set");
  }
  const ENV = process.env.NODE_ENV;
  if (!logger[ENV]) {
    throw new Error(`Invalid env: ${ENV}`);
  }
  const fastify = Fastify({ logger: logger[ENV] });

  // Do not parse any content. This means that our `request` won't have a body
  // attribute, we'll use `request.raw` to pipe the body directly into undici
  // https://fastify.dev/docs/v5.0.x/Reference/ContentTypeParser/
  fastify.removeAllContentTypeParsers();
  fastify.addContentTypeParser("*", (_request, _payload, done) => done(null));
  // Handle requests to proxy other websites
  fastify.all("/*", proxy);

  try {
    const port = Number(process.env.PORT) || 3000;
    // host is HOST if specified, otherwise defaults to 0.0.0.0 in prod and
    // 127.0.0.1 elsewhere
    const host =
      process.env.HOST || ENV === "production" ? "0.0.0.0" : "127.0.0.1";
    fastify.listen({ host, port });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
