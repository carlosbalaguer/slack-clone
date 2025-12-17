// scripts/extract-schema.ts
import pkg from 'pg';
const { Client } = pkg;
import 'dotenv/config';

async function extractSchema() {
	const client = new Client({
		connectionString: process.env.DATABASE_URL,
	});

	try {
		await client.connect();
		console.log('✅ Connected to database\n');

		// 1. Obtener todas las tablas
		const tablesResult = await client.query(`
			SELECT table_name 
			FROM information_schema.tables 
			WHERE table_schema = 'public' 
			AND table_type = 'BASE TABLE'
			ORDER BY table_name;
		`);

		console.log('📊 Tables found:', tablesResult.rows.length);
		console.log('─'.repeat(50));

		for (const row of tablesResult.rows) {
			const tableName = row.table_name;
			console.log(`\n🗂️  Table: ${tableName}`);
			console.log('─'.repeat(50));

			// 2. Obtener columnas de cada tabla
			const columnsResult = await client.query(`
				SELECT 
					column_name,
					data_type,
					column_default,
					is_nullable,
					character_maximum_length
				FROM information_schema.columns
				WHERE table_schema = 'public'
				AND table_name = $1
				ORDER BY ordinal_position;
			`, [tableName]);

			// 3. Obtener constraints (PK, FK, UNIQUE)
			const constraintsResult = await client.query(`
				SELECT
					tc.constraint_name,
					tc.constraint_type,
					kcu.column_name
				FROM information_schema.table_constraints tc
				JOIN information_schema.key_column_usage kcu
					ON tc.constraint_name = kcu.constraint_name
					AND tc.table_schema = kcu.table_schema
				WHERE tc.table_schema = 'public'
				AND tc.table_name = $1;
			`, [tableName]);

			// 4. Obtener indexes
			const indexesResult = await client.query(`
				SELECT
					indexname,
					indexdef
				FROM pg_indexes
				WHERE schemaname = 'public'
				AND tablename = $1;
			`, [tableName]);

			// Mostrar columnas
			console.log('\nColumns:');
			columnsResult.rows.forEach(col => {
				const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
				const type = col.character_maximum_length 
					? `${col.data_type}(${col.character_maximum_length})`
					: col.data_type;
				const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
				console.log(`  - ${col.column_name}: ${type} ${nullable}${defaultVal}`);
			});

			// Mostrar constraints
			if (constraintsResult.rows.length > 0) {
				console.log('\nConstraints:');
				constraintsResult.rows.forEach(con => {
					console.log(`  - ${con.constraint_type}: ${con.column_name} (${con.constraint_name})`);
				});
			}

			// Mostrar indexes
			if (indexesResult.rows.length > 0) {
				console.log('\nIndexes:');
				indexesResult.rows.forEach(idx => {
					console.log(`  - ${idx.indexname}`);
					console.log(`    ${idx.indexdef}`);
				});
			}
		}

		// 5. Generar CREATE TABLE statements
		console.log('\n\n' + '='.repeat(50));
		console.log('📝 CREATE TABLE Statements:');
		console.log('='.repeat(50) + '\n');

		for (const row of tablesResult.rows) {
			const tableName = row.table_name;
			
			// Obtener definición completa de la tabla
			const createTableResult = await client.query(`
				SELECT 
					'CREATE TABLE ' || quote_ident(table_name) || ' (' ||
					string_agg(
						quote_ident(column_name) || ' ' || 
						CASE 
							WHEN data_type = 'character varying' THEN 'VARCHAR(' || character_maximum_length || ')'
							WHEN data_type = 'timestamp without time zone' THEN 'TIMESTAMP'
							WHEN data_type = 'timestamp with time zone' THEN 'TIMESTAMPTZ'
							ELSE upper(data_type)
						END ||
						CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
						CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
						', '
					) || ');' as create_statement
				FROM information_schema.columns
				WHERE table_schema = 'public' 
				AND table_name = $1
				GROUP BY table_name;
			`, [tableName]);

			console.log(`-- Table: ${tableName}`);
			console.log(createTableResult.rows[0]?.create_statement || 'Could not generate statement');
			console.log('');

			// Mostrar constraints como ALTER TABLE
			const constraintsResult = await client.query(`
				SELECT
					'ALTER TABLE ' || quote_ident($1) || ' ADD CONSTRAINT ' ||
					constraint_name || ' ' ||
					CASE constraint_type
						WHEN 'PRIMARY KEY' THEN 'PRIMARY KEY (' || column_name || ')'
						WHEN 'FOREIGN KEY' THEN 'FOREIGN KEY (' || column_name || ') REFERENCES ...'
						WHEN 'UNIQUE' THEN 'UNIQUE (' || column_name || ')'
					END || ';' as constraint_statement
				FROM information_schema.table_constraints tc
				JOIN information_schema.key_column_usage kcu
					ON tc.constraint_name = kcu.constraint_name
				WHERE tc.table_schema = 'public'
				AND tc.table_name = $1
				AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE');
			`, [tableName]);

			constraintsResult.rows.forEach(con => {
				console.log(con.constraint_statement);
			});

			// Mostrar indexes como CREATE INDEX
			const indexesResult = await client.query(`
				SELECT indexdef || ';' as index_statement
				FROM pg_indexes
				WHERE schemaname = 'public'
				AND tablename = $1
				AND indexname NOT LIKE '%_pkey';
			`, [tableName]);

			indexesResult.rows.forEach(idx => {
				console.log(idx.index_statement);
			});

			console.log('');
		}

	} catch (error) {
		console.error('❌ Error:', error);
	} finally {
		await client.end();
	}
}

extractSchema();