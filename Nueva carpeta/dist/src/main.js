"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    });
    const swaggerPath = 'api-docs';
    app.use(swaggerPath, (req, res, next) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        next();
    });
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Broker AI Backend')
        .setDescription('Hybrid AI Trading System with Technical Analysis and Telegram Integration')
        .setVersion('1.0.0')
        .addTag('Analysis', 'Technical analysis and signal generation')
        .addTag('Orders', 'Trading order management')
        .addTag('Signals', 'Trading signal queries')
        .addTag('Performance', 'P&L and performance tracking')
        .addTag('Configuration', 'Symbol and parameter configuration')
        .addTag('Telegram', 'Telegram webhook integration')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup(swaggerPath, app, document, {
        swaggerOptions: {
            persistAuthorization: true,
            displayOperationId: true,
        },
        customCss: `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
          'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
          sans-serif;
        background: #f5f5f5;
      }
      .swagger-ui {
        --color-border: #d0d0d0;
        --color-background: #ffffff;
      }
      .topbar {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 20px;
      }
      .topbar-inner {
        max-width: 100%;
      }
      .information-container {
        margin: 0;
      }
    `,
        customJs: `
      window.onload = function() {
        const ui = SwaggerUIBundle.presets.reduce((ui) => ui, SwaggerUIBundle);
        const title = document.querySelector('.topbar-inner h1');
        if (title) {
          title.textContent = 'Broker AI Trading API';
        }
      }
    `,
    });
    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`✅ Broker AI Backend running on http://localhost:${port}`);
    console.log(`📚 API Documentation available at http://localhost:${port}/api-docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map