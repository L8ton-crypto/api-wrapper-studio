import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const sql = neon(process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/db');
    
    await sql`
      CREATE TABLE IF NOT EXISTS aw_wrappers (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        auth_type TEXT NOT NULL DEFAULT 'none',
        auth_config JSONB DEFAULT '{}',
        endpoints JSONB DEFAULT '[]',
        middleware JSONB DEFAULT '{"rateLimit":{"enabled":false,"requests":100,"windowMs":60000},"cache":{"enabled":false,"ttlSeconds":300},"retry":{"enabled":true,"attempts":3,"backoffMs":1000},"timeout":{"enabled":true,"ms":10000}}',
        share_code TEXT UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database initialization error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initialize database' },
      { status: 500 }
    );
  }
}