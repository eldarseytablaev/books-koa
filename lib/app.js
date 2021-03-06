'use strict';

const Koa = require('koa');
const compress = require('koa-compress');
const respond = require('koa-respond');
const cors = require('@koa/cors');
const bodyParser = require('koa-bodyparser');

const { createContainer, Lifetime, InjectionMode, asValue } = require('awilix');
const { loadControllers, scopePerRequest } = require('awilix-koa');

const logger = require('log4js');

const app = new Koa();

const { notFoundHandler } = require('../middlewares/not-found');
const { registerContext } = require('../middlewares/register-context');
const { errorHandler } = require('../middlewares/error-handler');
const { swaggerYml, swaggerClient } = require('../middlewares/swagger');

const config = require('../config/config.json');
const { MysqlProvider } = require('../database/mysql.provider');
const { nameDbProviders } = require('../database/name-db-providers');

const databaseProviders = [
  { providerInstance: new MysqlProvider(config.mysql, logger) }
];

/**
 * Using Awilix, the following files and folders (glob patterns)
 * will be loaded.
 */
const modulesToLoad = [
  // Services should be scoped to the request.
  // This means that each request gets a separate instance
  // of a service.
  ['modules/*/*.service.js', Lifetime.SCOPED],
  // Stores will be singleton (1 instance per process).
  // This is just for demo purposes, you can do whatever you want.
  ['modules/*/*.store.js', Lifetime.SINGLETON]
];

/**
 * Configures a new container.
 *
 * @return {Object} The container.
 */

const opts = {
  // Classic means Awilix will look at function parameter
  // names rather than passing a Proxy.
  injectionMode: InjectionMode.CLASSIC
};
const container = createContainer(opts)
  .loadModules(modulesToLoad, {
    // `modulesToLoad` paths should be relative
    // to this file's parent directory.
    cwd: `${__dirname}/..`,
    // Example: registers `services/todo-service.js` as `todoService`
    formatName: 'camelCase'
  })
  .register({
    // Our logger is already constructed,
    // so provide it as-is to anyone who wants it.
    config: asValue(config),
    logger: asValue(logger),
    mysql: asValue(databaseProviders.find(dbProvider => dbProvider.providerInstance.name === nameDbProviders.MYSQL).providerInstance)
  });

// Container is configured with our services and whatnot.
// const container = (app.container = configureContainer());

app // Top middleware is the error handler.
  .use(errorHandler)
  // Compress all responses.
  .use(compress())
  // Adds ctx.ok(), ctx.notFound(), etc..
  .use(respond())
  // Handles CORS.
  .use(cors())
  // Parses request bodies.
  .use(bodyParser())
  // Creates an Awilix scope per request. Check out the awilix-koa
  // docs for details: https://github.com/jeffijoe/awilix-koa
  .use(scopePerRequest(container))
  // Create a middleware to add request-specific data to the scope.
  .use(registerContext)
  // Load routes (API "controllers")
  .use(loadControllers('../modules/*/*.route.js', { cwd: __dirname }))
  // Swagger client `/api`
  .use(swaggerClient())
  // Swagger yaml file `/swagger.yaml`
  .use(swaggerYml)
  // Default handler when nothing stopped the chain.
  .use(notFoundHandler);

module.exports = { app, databaseProviders };
