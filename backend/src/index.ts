import "./tracing.js";
import { build } from './app.js';

const start = async () => {
  const app = await build();
  
  try {
    await app.listen({ 
      port: Number(process.env.PORT) || 3001,
      host: '0.0.0.0'
    });
    
    console.log('🚀 Fastify server running on http://localhost:3001');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();