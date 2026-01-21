const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'db/nocodb.sqlite'); 
console.log('Opening DB:', dbPath);

try {
  const db = new Database(dbPath, { fileMustExist: true });
  
  const targetId = '55dc9586-6b59-478a-9755-e6edd3fe279d';
  console.log('Checking rows for table:', targetId);
  
  const rows = db.prepare("SELECT id, data FROM rows WHERE table_id = ?").all(targetId);
  console.log(`Found ${rows.length} rows.`);
  
  rows.forEach((row, i) => {
      try {
          JSON.parse(row.data);
      } catch (e) {
          console.error(`Row ${i} (ID: ${row.id}) has invalid JSON:`, row.data);
      }
  });
  
  // Also check if any row.data is not a string (shouldn't happen in sqlite if typed TEXT but who knows)
  rows.forEach((row, i) => {
      if (typeof row.data !== 'string') {
          console.log(`Row ${i} (ID: ${row.id}) data is type ${typeof row.data}:`, row.data);
      }
  });

  console.log('Done checking rows.');

} catch (err) {
  console.error('Error:', err);
}
