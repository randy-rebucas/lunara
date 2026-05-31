import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.init();
  }

  private init() {
    if (this.app) return;

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase credentials missing — push delivery disabled');
      return;
    }

    try {
      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      this.logger.log('Firebase Admin initialized');
    } catch (err) {
      this.logger.error('Failed to initialize Firebase Admin', err);
    }
  }

  isEnabled(): boolean {
    return this.app !== null;
  }

  messaging(): admin.messaging.Messaging | null {
    if (!this.app) return null;
    return admin.messaging(this.app);
  }
}
