import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { spawn } from 'child_process';
import * as path from 'path';
import { reseedLaundryAddons, reseedLaundryServices } from '../catalog/catalog.seed';
import { reseedPromotions } from '../promotions/promotions.seed';
import { reseedBlogPosts } from '../blog/blog.seed';

const ALLOWED_SCRIPTS = [
  'seed',
  'seed:promotions',
  'seed:services',
  'seed:addons',
  'migrate:settlement-ledger',
] as const;


const RESET_SCOPE_MAP: Record<string, string[]> = {
  orders: ['orders'],
  settlements: ['partner_settlements', 'ledger_entries'],
  ledger: ['ledger_entries'],
  wallets: ['wallets', 'rider_wallets'],
  remittances: ['rider_cash_remittances'],
  users: ['users', 'riders', 'customers', 'addresses', 'wallets', 'rider_wallets'],
  all: [
    'orders',
    'partner_settlements',
    'ledger_entries',
    'wallets',
    'rider_wallets',
    'rider_cash_remittances',
    'rider_withdrawals',
    'payments',
    'support_tickets',
    'refunds',
  ],
};

@Injectable()
export class MaintenanceService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async getStatus() {
    const db = this.connection.db!;
    const list = await db.listCollections().toArray();
    const stats = await Promise.all(
      list.map(async (col) => {
        const count = await db.collection(col.name).countDocuments();
        return { collection: col.name, count };
      }),
    );
    return stats.sort((a, b) => a.collection.localeCompare(b.collection));
  }

  async runSeed(target: 'users' | 'services' | 'addons' | 'promotions' | 'blog' | 'all') {
    const db = this.connection.db!;
    const log: string[] = [];

    if (target === 'services' || target === 'all') {
      await reseedLaundryServices(db.collection('laundry_services'));
      log.push('Seeded laundry services');
    }
    if (target === 'addons' || target === 'all') {
      await reseedLaundryAddons(db.collection('laundry_addons'));
      log.push('Seeded laundry add-ons');
    }
    if (target === 'promotions' || target === 'all') {
      await reseedPromotions(db.collection('promotions'));
      log.push('Seeded promotions');
    }
    if (target === 'blog' || target === 'all') {
      await reseedBlogPosts(db.collection('blog_posts'));
      log.push('Seeded blog posts');
    }
    if (target === 'users' || target === 'all') {
      const passwordHash = await bcrypt.hash('password123', 12);
      const seeds = [
        { email: 'partner@lunara.dev', role: 'partner', phone: '+639171111111' },
        { email: 'rider@lunara.dev', role: 'rider', phone: '+639172222222' },
        { email: 'admin@lunara.dev', role: 'admin', phone: '+639173333333' },
        { email: 'staff@lunara.dev', role: 'staff', phone: '+639174444444' },
        { email: 'customer@lunara.dev', role: 'customer', phone: '+639175555555' },
      ];
      for (const s of seeds) {
        await db.collection('users').updateOne(
          { email: s.email },
          {
            $set: { email: s.email, phone: s.phone, passwordHash, role: s.role, isActive: true, updatedAt: new Date() },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true },
        );
        log.push(`Upserted ${s.role}: ${s.email}`);
      }
    }

    return { log, count: log.length };
  }

  async resetCollections(scope: string) {
    const collections = RESET_SCOPE_MAP[scope];
    if (!collections) throw new BadRequestException(`Unknown reset scope: ${scope}`);

    const db = this.connection.db!;
    const dropped: string[] = [];

    for (const col of collections) {
      try {
        await db.dropCollection(col);
        dropped.push(col);
      } catch (e: unknown) {
        // ignore "ns not found" — collection already empty/absent
        if (!(e instanceof Error) || !e.message.includes('ns not found')) throw e;
      }
    }

    return { dropped, scope };
  }

  async runScript(script: string) {
    if (!(ALLOWED_SCRIPTS as readonly string[]).includes(script)) {
      throw new BadRequestException(
        `Script "${script}" is not in the allowed list. Allowed: ${ALLOWED_SCRIPTS.join(', ')}`,
      );
    }

    return new Promise<{ output: string; exitCode: number }>((resolve, reject) => {
      // Run from repo root so workspace flag works
      const repoRoot = path.resolve(__dirname, '../../../../../../');
      const child = spawn('npm', ['run', script, '--workspace=@lunara/api'], {
        cwd: repoRoot,
        shell: true,
        env: { ...process.env },
      });

      const chunks: string[] = [];
      child.stdout?.on('data', (d: Buffer) => chunks.push(d.toString()));
      child.stderr?.on('data', (d: Buffer) => chunks.push(d.toString()));

      const timer = setTimeout(() => {
        child.kill();
        reject(new BadRequestException(`Script "${script}" timed out after 60 seconds`));
      }, 60_000);

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ output: chunks.join(''), exitCode: code ?? 1 });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  async createBackup(): Promise<Buffer> {
    const db = this.connection.db!;
    const cols = await db.listCollections().toArray();
    const backup: Record<string, unknown[]> = {};
    for (const col of cols) {
      backup[col.name] = await db.collection(col.name).find({}).toArray();
    }
    return Buffer.from(JSON.stringify(backup), 'utf8');
  }

  async restoreBackup(jsonBuffer: Buffer): Promise<{ result: string }> {
    let backup: Record<string, unknown[]>;
    try {
      backup = JSON.parse(jsonBuffer.toString('utf8')) as Record<string, unknown[]>;
    } catch {
      throw new BadRequestException('Invalid backup file — expected JSON archive');
    }

    const db = this.connection.db!;
    const restored: string[] = [];

    for (const [colName, docs] of Object.entries(backup)) {
      try { await db.dropCollection(colName); } catch { /* already gone */ }
      if (docs.length > 0) {
        await db.collection(colName).insertMany(docs as Record<string, unknown>[]);
      }
      restored.push(`${colName}: ${docs.length} docs`);
    }

    return { result: restored.join('\n') };
  }
}
