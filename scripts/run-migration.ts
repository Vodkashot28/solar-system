import postgres from "postgres";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

async function runMigration() {
  const sql = postgres(DATABASE_URL, { max: 1 });
  
  try {
    const migrationPath = path.join(process.cwd(), "drizzle", "0005_windy_hairball.sql");
    const migrationSQL = fs.readFileSync(migrationPath, "utf-8");
    
    // Split by statement-breakpoint and execute each statement
    const statements = migrationSQL
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("--"));
    
    console.log(`📦 Running migration with ${statements.length} statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt) continue;
      
      try {
        await sql.unsafe(stmt);
        console.log(`   ✓ Statement ${i + 1}/${statements.length}`);
      } catch (err: any) {
        // Skip if already exists errors
        if (err.code === "42P07" || err.code === "42701") {
          console.log(`   ⊙ Statement ${i + 1} already applied (${err.code})`);
          continue;
        }
        console.error(`   ✗ Statement ${i + 1} failed:`, err.message);
        console.error(`     SQL: ${stmt.substring(0, 100)}...`);
        throw err;
      }
    }
    
    console.log("✅ Migration completed successfully!");
  } catch (err: any) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
