import { SpeechClient } from '@google-cloud/speech';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export class AudioTranscriber {
  private speechClient: SpeechClient | null = null;
  private storageClient: Storage | null = null;
  private bucketName: string;

  constructor() {
    // Initialize Google Cloud Speech client using same credentials as Calendar service
    try {
      const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      const projectId = process.env.GOOGLE_CLOUD_PROJECT;
      
      // Use service account key file if available (same as Calendar service)
      if (credentials) {
        this.speechClient = new SpeechClient({
          keyFilename: credentials
        });
        this.storageClient = new Storage({
          keyFilename: credentials
        });
        console.log('[AudioTranscriber] Google Cloud Speech-to-Text and Storage initialized');
      } else if (projectId) {
        // Fallback to application default credentials
        this.speechClient = new SpeechClient();
        this.storageClient = new Storage();
        console.log('[AudioTranscriber] Google Cloud Speech-to-Text and Storage initialized (ADC)');
      } else {
        console.warn('[AudioTranscriber] Google Cloud credentials not found, transcription will be skipped');
      }
      
      // Get bucket name from env or use default
      this.bucketName = process.env.GCS_BUCKET_NAME || `${projectId || 'eventide-ai'}-audio-transcription`;
    } catch (error: any) {
      console.warn('[AudioTranscriber] Failed to initialize clients:', error.message);
      this.speechClient = null;
      this.storageClient = null;
    }
  }

  /**
   * Transcribe audio file to text
   * @param audioPath - Path to audio file (WAV, MP3, FLAC, etc.)
   * @returns Transcribed text
   */
  async transcribe(audioPath: string): Promise<string> {
    try {
      // Try Google Cloud Speech-to-Text first
      if (this.speechClient) {
        return await this.transcribeWithGoogleSpeech(audioPath);
      }
      
      // Fallback: Use Gemini to transcribe (if audio is short enough)
      // Or use a local Whisper model
      return await this.transcribeWithGemini(audioPath);
    } catch (error: any) {
      console.error('[AudioTranscriber] Transcription error:', error.message);
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }

  /**
   * Transcribe using Google Cloud Speech-to-Text API
   * Optimized for speed: uses synchronous recognition for short audio (first 3 minutes)
   */
  private async transcribeWithGoogleSpeech(audioPath: string): Promise<string> {
    if (!this.speechClient) {
      throw new Error('Speech client not initialized');
    }

    const fileStats = fs.statSync(audioPath);
    const fileSizeMB = fileStats.size / (1024 * 1024);
    const maxSizeMB = 10; // 10MB limit for synchronous recognition
    
    // For audio files under 10MB (typically 3-4 minutes at 16kHz), use fast synchronous recognition
    if (fileSizeMB <= maxSizeMB) {
      console.log(`[AudioTranscriber] File size (${fileSizeMB.toFixed(2)}MB) - using fast synchronous recognition...`);
      const audioBytes = fs.readFileSync(audioPath).toString('base64');
      
      const request = {
        audio: {
          content: audioBytes,
        },
        config: {
          encoding: 'LINEAR16' as const,
          sampleRateHertz: 16000,
          languageCode: 'en-US',
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: false,
        },
      };

      try {
        const [response] = await this.speechClient.recognize(request);
        
        if (!response.results || response.results.length === 0) {
          return '';
        }

        const transcription = response.results
          .map(result => result.alternatives?.[0]?.transcript || '')
          .join(' ');

        console.log(`[AudioTranscriber] Transcribed ${transcription.length} characters (synchronous)`);
        return transcription;
      } catch (error: any) {
        // If synchronous recognition fails, fall back to chunking
        console.warn('[AudioTranscriber] Synchronous recognition failed, trying chunked approach...');
        return await this.transcribeInChunks(audioPath);
      }
    } else {
      // For larger files, use chunked approach (faster than LongRunningRecognize)
      console.log(`[AudioTranscriber] File size (${fileSizeMB.toFixed(2)}MB) - using chunked transcription...`);
      return await this.transcribeInChunks(audioPath);
    }
  }

  /**
   * Transcribe audio in chunks for faster processing
   * Splits audio into 30-second chunks (under 1-minute limit) and transcribes in parallel
   */
  private async transcribeInChunks(audioPath: string): Promise<string> {
    if (!this.speechClient) {
      throw new Error('Speech client not initialized');
    }

    const ffmpeg = require('fluent-ffmpeg');
    const chunkDuration = 30; // 30-second chunks (safe under 1-minute limit)
    const tempDir = path.dirname(audioPath);
    const chunks: string[] = [];
    const transcriptions: string[] = [];

    try {
      // Get audio duration
      const duration = await new Promise<number>((resolve, reject) => {
        ffmpeg.ffprobe(audioPath, (err: any, metadata: any) => {
          if (err) reject(err);
          else resolve(metadata.format.duration || 0);
        });
      });

      const numChunks = Math.ceil(duration / chunkDuration);
      console.log(`[AudioTranscriber] Splitting ${duration.toFixed(0)}s audio into ${numChunks} chunks...`);

      // Extract chunks in parallel
      const chunkPromises: Promise<string>[] = [];
      for (let i = 0; i < numChunks; i++) {
        const startTime = i * chunkDuration;
        const chunkPath = path.join(tempDir, `chunk-${i}-${Date.now()}.wav`);
        chunks.push(chunkPath);

        chunkPromises.push(
          new Promise<string>((resolve, reject) => {
            ffmpeg(audioPath)
              .seekInput(startTime)
              .duration(chunkDuration)
              .output(chunkPath)
              .audioCodec('pcm_s16le')
              .audioFrequency(16000)
              .audioChannels(1)
              .on('end', () => resolve(chunkPath))
              .on('error', reject)
              .run();
          })
        );
      }

      await Promise.all(chunkPromises);
      console.log(`[AudioTranscriber] Extracted ${chunks.length} chunks, transcribing in parallel...`);

      // Transcribe all chunks in parallel
      const transcriptionPromises = chunks.map(async (chunkPath) => {
        try {
          const audioBytes = fs.readFileSync(chunkPath).toString('base64');
          const [response] = await this.speechClient!.recognize({
            audio: { content: audioBytes },
            config: {
              encoding: 'LINEAR16' as const,
              sampleRateHertz: 16000,
              languageCode: 'en-US',
              enableAutomaticPunctuation: true,
            },
          });

          // Clean up chunk file
          fs.unlinkSync(chunkPath);

          return response.results
            ?.map(r => r.alternatives?.[0]?.transcript || '')
            .join(' ') || '';
        } catch (error: any) {
          console.warn(`[AudioTranscriber] Failed to transcribe chunk ${chunkPath}:`, error.message);
          // Clean up chunk file
          try { fs.unlinkSync(chunkPath); } catch {}
          return '';
        }
      });

      const chunkTranscriptions = await Promise.all(transcriptionPromises);
      const fullTranscription = chunkTranscriptions.filter(Boolean).join(' ');

      console.log(`[AudioTranscriber] Transcribed ${fullTranscription.length} characters from ${chunks.length} chunks`);
      return fullTranscription;
    } catch (error: any) {
      // Clean up any remaining chunks
      chunks.forEach(chunk => {
        try { fs.unlinkSync(chunk); } catch {}
      });
      throw error;
    }
  }

  /**
   * Transcribe full audio file using LongRunningRecognize with GCS
   * This handles files of any length
   */
  private async transcribeWithLongRunning(audioPath: string): Promise<string> {
    if (!this.speechClient || !this.storageClient) {
      throw new Error('Speech or Storage client not initialized');
    }

    const fileName = `audio-${Date.now()}.wav`;
    const gcsUri = `gs://${this.bucketName}/${fileName}`;

    try {
      // Step 1: Ensure bucket exists
      await this.ensureBucketExists();

      // Step 2: Upload audio file to GCS
      console.log(`[AudioTranscriber] Uploading audio to GCS: ${gcsUri}`);
      const bucket = this.storageClient.bucket(this.bucketName);
      await bucket.upload(audioPath, {
        destination: fileName,
        metadata: {
          contentType: 'audio/wav',
        },
      });
      console.log(`[AudioTranscriber] Upload complete, starting LongRunningRecognize...`);

      // Step 3: Start LongRunningRecognize operation
      const request = {
        audio: {
          uri: gcsUri,
        },
        config: {
          encoding: 'LINEAR16' as const,
          sampleRateHertz: 16000,
          languageCode: 'en-US',
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: false,
        },
      };

      const [operation] = await this.speechClient.longRunningRecognize(request);
      console.log(`[AudioTranscriber] LongRunningRecognize operation started: ${operation.name}`);

      // Step 4: Wait for operation to complete (with timeout)
      const maxWaitTime = 10 * 60 * 1000; // 10 minutes max
      
      // Use Promise.race to implement timeout
      const operationPromise = operation.promise();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('LongRunningRecognize operation timed out after 10 minutes'));
        }, maxWaitTime);
      });

      try {
        const [response] = await Promise.race([operationPromise, timeoutPromise]) as any;
        
        if (response.error) {
          throw new Error(`LongRunningRecognize failed: ${response.error.message}`);
        }

        const results = response.results || [];
        if (results.length === 0) {
          console.warn('[AudioTranscriber] No transcription results');
          return '';
        }

        const transcription = results
          .map((result: any) => result.alternatives?.[0]?.transcript || '')
          .join(' ');

        console.log(`[AudioTranscriber] Transcribed ${transcription.length} characters from full video`);
        
        // Clean up GCS file
        try {
          await bucket.file(fileName).delete();
          console.log(`[AudioTranscriber] Cleaned up GCS file: ${fileName}`);
        } catch (e) {
          console.warn(`[AudioTranscriber] Failed to delete GCS file: ${e}`);
        }

        return transcription;
      } catch (timeoutError: any) {
        throw timeoutError;
      }
    } catch (error: any) {
      // Clean up GCS file on error
      try {
        const bucket = this.storageClient!.bucket(this.bucketName);
        await bucket.file(fileName).delete().catch(() => {});
      } catch (e) {
        // Ignore cleanup errors
      }
      
      throw new Error(`LongRunningRecognize failed: ${error.message}`);
    }
  }

  /**
   * Ensure GCS bucket exists, create if it doesn't
   */
  private async ensureBucketExists(): Promise<void> {
    if (!this.storageClient) {
      throw new Error('Storage client not initialized');
    }

    try {
      const bucket = this.storageClient.bucket(this.bucketName);
      const [exists] = await bucket.exists();
      
      if (!exists) {
        console.log(`[AudioTranscriber] Creating GCS bucket: ${this.bucketName}`);
        await bucket.create({
          location: 'US', // Change if needed
          storageClass: 'STANDARD',
        });
        console.log(`[AudioTranscriber] GCS bucket created: ${this.bucketName}`);
      }
    } catch (error: any) {
      // If bucket creation fails, it might already exist or we don't have permissions
      // Try to continue anyway
      console.warn(`[AudioTranscriber] Could not ensure bucket exists: ${error.message}`);
    }
  }

  /**
   * Fallback: Transcribe first portion of audio file directly
   */
  private async transcribeAudioChunk(audioPath: string): Promise<string> {
    if (!this.speechClient) {
      throw new Error('Speech client not initialized');
    }

    // Read first 5MB of audio (should be ~30-40 seconds at 16kHz)
    const maxChunkSize = 5 * 1024 * 1024; // 5MB
    const audioBuffer = fs.readFileSync(audioPath);
    const chunkBuffer = audioBuffer.slice(0, maxChunkSize);
    const audioBytes = chunkBuffer.toString('base64');
    
    console.log(`[AudioTranscriber] Transcribing first ${(chunkBuffer.length / (1024 * 1024)).toFixed(2)}MB of audio...`);
    
    const request = {
      audio: {
        content: audioBytes,
      },
      config: {
        encoding: 'LINEAR16' as const,
        sampleRateHertz: 16000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false,
      },
    };

    try {
      const [response] = await this.speechClient.recognize(request);
      
      if (!response.results || response.results.length === 0) {
        console.warn('[AudioTranscriber] No transcription results from chunk');
        return '';
      }

      const transcription = response.results
        .map(result => result.alternatives?.[0]?.transcript || '')
        .join(' ');

      console.log(`[AudioTranscriber] Transcribed ${transcription.length} characters from audio chunk`);
      return transcription;
    } catch (error: any) {
      // If still fails, return empty string (transcription is optional)
      console.warn('[AudioTranscriber] Transcription failed, continuing without it:', error.message);
      return '';
    }
  }

  /**
   * Fallback: Use Gemini to analyze audio (if available)
   * Note: Gemini doesn't directly support audio, so this is a placeholder
   * In production, you'd use Whisper API or local Whisper model
   */
  private async transcribeWithGemini(audioPath: string): Promise<string> {
    // For now, return empty string
    // In a real implementation, you could:
    // 1. Use OpenAI Whisper API
    // 2. Use a local Whisper model
    // 3. Use AssemblyAI or other transcription services
    
    console.warn('[AudioTranscriber] Gemini transcription not implemented, returning empty string');
    return '';
  }
}

