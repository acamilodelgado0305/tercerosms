import app from './app.js';
import './database.js';

async function main() {
    await app.listen(app.get('port'));
    console.log('servidor en puerto', app.get('port'));
}

main();
