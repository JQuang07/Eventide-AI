import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
const { exec } = require('child_process');
const { promisify: promisifyUtil } = require('util');
const execAsync = promisifyUtil(exec);

export interface VideoFrame {
  timestamp: number;
  base64: string;
}

export interface VideoExtractionResult {
  frames: VideoFrame[];
  audioPath?: string;
  duration: number;
}

export class VideoFrameExtractor {
  private tempDir: string;

  constructor() {
    // Create temp directory for frames
    this.tempDir = path.join(process.cwd(), 'temp', 'video-frames');
    this.ensureTempDir();
  }

  /**
   * Extract frames and audio from a video URL
   * Uses streaming approach to avoid downloading full video
   * @param videoUrl - URL of the video to extract frames from
   * @param frameCount - Number of frames to extract (default: 5)
   * @param extractAudio - Whether to extract audio (default: true)
   * @returns Video extraction result with frames and audio path
   */
  async extractFrames(videoUrl: string, frameCount: number = 5, extractAudio: boolean = true): Promise<VideoExtractionResult> {
    try {
      // Check if it's a platform that yt-dlp supports - use streaming approach
      const ytDlpSupportedPlatforms = [
        'youtube.com', 'youtu.be',
        'tiktok.com',
        'instagram.com',
        'twitter.com', 'x.com',
        'facebook.com',
        'vimeo.com',
        'dailymotion.com'
      ];
      
      const isYtDlpSupported = ytDlpSupportedPlatforms.some(platform => videoUrl.includes(platform));
      
      // TikTok requires download first (stream URLs expire quickly with 403 errors)
      if (videoUrl.includes('tiktok.com')) {
        return await this.extractFromDownloadedVideo(videoUrl, frameCount, extractAudio);
      }
      
      if (isYtDlpSupported) {
        return await this.extractFromStream(videoUrl, frameCount, extractAudio);
      }
      
      // For other videos, use traditional download approach
      console.log(`[VideoFrameExtractor] Downloading video from: ${videoUrl}`);
      const videoPath = await this.downloadVideo(videoUrl);
      
      // Get video duration
      const duration = await this.getVideoDuration(videoPath);
      console.log(`[VideoFrameExtractor] Video duration: ${duration}s`);

      // Skip videos longer than 10 minutes
      if (duration > 600) {
        await this.cleanupFile(videoPath);
        throw new Error('Video too long. Maximum 10 minutes supported.');
      }

      // Calculate timestamps for frames
      const timestamps = this.calculateSmartTimestamps(duration, frameCount);
      console.log(`[VideoFrameExtractor] Extracting frames at: ${timestamps.join(', ')}s`);

      // Extract frames
      const frames: VideoFrame[] = [];
      for (const timestamp of timestamps) {
        try {
          const frameBase64 = await this.extractFrameAtTime(videoPath, timestamp);
          if (frameBase64) {
            frames.push({
              timestamp,
              base64: frameBase64
            });
          }
        } catch (error) {
          console.warn(`[VideoFrameExtractor] Failed to extract frame at ${timestamp}s:`, error);
          // Continue with other frames
        }
      }

      // Extract audio if requested
      let audioPath: string | undefined;
      if (extractAudio) {
        try {
          audioPath = await this.extractAudio(videoPath);
          console.log(`[VideoFrameExtractor] Extracted audio to: ${audioPath}`);
        } catch (error: any) {
          console.warn(`[VideoFrameExtractor] Failed to extract audio:`, error.message);
          // Continue without audio
        }
      }

      // Clean up temp video file (but keep audio for now)
      await this.cleanupFile(videoPath);

      if (frames.length === 0) {
        throw new Error('No frames could be extracted from video');
      }

      console.log(`[VideoFrameExtractor] Extracted ${frames.length} frames${audioPath ? ' and audio' : ''}`);
      return {
        frames,
        audioPath,
        duration
      };
    } catch (error: any) {
      console.error('[VideoFrameExtractor] Error extracting frames:', error.message);
      throw new Error(`Failed to extract video frames: ${error.message}`);
    }
  }

  /**
   * Extract frames from video URL using streaming (no full download)
   * Uses yt-dlp to get video info and extract frames directly
   * Works with YouTube, TikTok, Instagram, and other yt-dlp supported platforms
   */
  private async extractFromStream(videoUrl: string, frameCount: number, extractAudio: boolean): Promise<VideoExtractionResult> {
    const platform = this.getPlatformName(videoUrl);
    try {
      console.log(`[VideoFrameExtractor] Extracting from ${platform} using streaming approach...`);
      
      // Step 1: Get video duration and info without downloading
      const duration = await this.getVideoDurationFromUrl(videoUrl);
      console.log(`[VideoFrameExtractor] Video duration: ${duration}s`);

      // Step 2: Calculate timestamps
      const timestamps = this.calculateSmartTimestamps(duration, frameCount);
      console.log(`[VideoFrameExtractor] Extracting frames at: ${timestamps.join(', ')}s`);

      // Step 3: Extract frames in PARALLEL for speed (with timeout per frame)
      // First, get the stream URL once (shared across all frames)
      console.log(`[VideoFrameExtractor] Getting video stream URL...`);
      let streamUrl: string;
      try {
        // For TikTok and some platforms, we might need different format selection
        const formatSelector = videoUrl.includes('tiktok.com') 
          ? 'best' // TikTok often has limited format options
          : 'best[height<=720]';
        
        const { stdout } = await execAsync(
          `yt-dlp -f "${formatSelector}" -g "${videoUrl}"`,
          { timeout: 20000 } // 20 second timeout for TikTok
        );
        streamUrl = stdout.trim();
        if (!streamUrl) {
          throw new Error('No stream URL returned from yt-dlp');
        }
      } catch (error: any) {
        throw new Error(`Failed to get stream URL: ${error.message}`);
      }

      console.log(`[VideoFrameExtractor] Extracting ${timestamps.length} frames in parallel from stream...`);
      const framePromises = timestamps.map(async (timestamp) => {
        try {
          // Add timeout to each frame extraction (10 seconds max per frame)
          const frameBase64 = await Promise.race([
            this.extractFrameFromStream(streamUrl, timestamp),
            new Promise<string | null>((_, reject) => 
              setTimeout(() => reject(new Error('Frame extraction timeout')), 10000)
            )
          ]);
          if (frameBase64) {
            return { timestamp, base64: frameBase64 };
          }
          return null;
        } catch (error: any) {
          console.warn(`[VideoFrameExtractor] Failed to extract frame at ${timestamp}s:`, error.message);
          return null;
        }
      });

      // Wait for all frames with overall timeout (30 seconds max)
      const frameResults = await Promise.race([
        Promise.all(framePromises),
        new Promise<Array<VideoFrame | null>>((_, reject) => 
          setTimeout(() => reject(new Error('Frame extraction overall timeout')), 30000)
        )
      ]).catch(() => {
        console.warn('[VideoFrameExtractor] Frame extraction timed out, using partial results');
        return framePromises.map(() => null); // Return nulls for timeout
      });
      
      const frames = (frameResults as Array<VideoFrame | null>).filter((f): f is VideoFrame => f !== null);

      // Step 4: Extract audio (first 2 minutes for speed - most event info is in first 2 min)
      let audioPath: string | undefined;
      if (extractAudio) {
        try {
          audioPath = await this.extractAudioFromUrl(videoUrl, 120); // 2 minutes (faster)
          console.log(`[VideoFrameExtractor] Extracted audio (first 2 min) to: ${audioPath}`);
        } catch (error: any) {
          console.warn(`[VideoFrameExtractor] Failed to extract audio:`, error.message);
          // Continue without audio
        }
      }

      if (frames.length === 0) {
        throw new Error('No frames could be extracted from video');
      }

      console.log(`[VideoFrameExtractor] Extracted ${frames.length} frames${audioPath ? ' and audio' : ''}`);
      return {
        frames,
        audioPath,
        duration
      };
    } catch (error: any) {
      console.error(`[VideoFrameExtractor] Error extracting from ${platform}:`, error.message);
      throw new Error(`Failed to extract from ${platform}: ${error.message}`);
    }
  }

  /**
   * Get video duration from URL without downloading (works with yt-dlp supported platforms)
   */
  private async getVideoDurationFromUrl(videoUrl: string): Promise<number> {
    try {
      // Use yt-dlp to get video info (JSON) without downloading
      const { stdout } = await execAsync(
        `yt-dlp --dump-json --no-download "${videoUrl}"`,
        { timeout: 30000 } // 30 second timeout
      );
      
      const videoInfo = JSON.parse(stdout);
      return videoInfo.duration || 0;
    } catch (error: any) {
      throw new Error(`Failed to get video info: ${error.message}`);
    }
  }

  /**
   * Get platform name from URL
   */
  private getPlatformName(videoUrl: string): string {
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) return 'YouTube';
    if (videoUrl.includes('tiktok.com')) return 'TikTok';
    if (videoUrl.includes('instagram.com')) return 'Instagram';
    if (videoUrl.includes('twitter.com') || videoUrl.includes('x.com')) return 'Twitter/X';
    if (videoUrl.includes('facebook.com')) return 'Facebook';
    if (videoUrl.includes('vimeo.com')) return 'Vimeo';
    if (videoUrl.includes('dailymotion.com')) return 'Dailymotion';
    return 'Video Platform';
  }

  /**
   * Extract a single frame from a stream URL at a specific timestamp
   * Optimized version that uses pre-fetched stream URL
   */
  private async extractFrameFromStream(streamUrl: string, timestamp: number): Promise<string | null> {
    const outputPath = path.join(this.tempDir, `frame-${timestamp}-${Date.now()}.jpg`);
    
    try {
      // Use ffmpeg to extract frame from stream
      return new Promise((resolve, reject) => {
        ffmpeg(streamUrl)
          .seekInput(timestamp)
          .frames(1)
          .output(outputPath)
          .on('end', async () => {
            try {
              const frameBuffer = await readFile(outputPath);
              const base64 = frameBuffer.toString('base64');
              const dataUri = `data:image/jpeg;base64,${base64}`;
              
              await this.cleanupFile(outputPath);
              resolve(dataUri);
            } catch (error) {
              reject(error);
            }
          })
          .on('error', (err) => {
            this.cleanupFile(outputPath).catch(() => {});
            reject(err);
          })
          .run();
      });
    } catch (error: any) {
      await this.cleanupFile(outputPath).catch(() => {});
      throw new Error(`Failed to extract frame: ${error.message}`);
    }
  }

  /**
   * Extract a single frame from YouTube at a specific timestamp using streaming
   * @deprecated Use extractFrameFromStream with pre-fetched URL for better performance
   */
  private async extractYouTubeFrameAtTime(videoUrl: string, timestamp: number): Promise<string | null> {
    const outputPath = path.join(this.tempDir, `frame-${timestamp}-${Date.now()}.jpg`);
    
    try {
      // Use yt-dlp to get video stream URL (without downloading)
      const { stdout } = await execAsync(
        `yt-dlp -f "best[height<=720]" -g "${videoUrl}"`,
        { timeout: 15000 } // 15 second timeout
      );
      
      const streamUrl = stdout.trim();
      if (!streamUrl) {
        throw new Error('No stream URL returned from yt-dlp');
      }

      return await this.extractFrameFromStream(streamUrl, timestamp);
    } catch (error: any) {
      await this.cleanupFile(outputPath).catch(() => {});
      throw new Error(`Failed to extract frame: ${error.message}`);
    }
  }

  /**
   * Extract audio from video URL (optimized: first 2 minutes for speed)
   * Works with yt-dlp supported platforms (YouTube, TikTok, Instagram, etc.)
   * Most event information is mentioned in the first 2 minutes
   */
  private async extractAudioFromUrl(videoUrl: string, maxDurationSeconds: number = 120): Promise<string> {
    const audioPath = path.join(this.tempDir, `audio-${Date.now()}.wav`);
    
    try {
      // Get audio stream URL using yt-dlp
      const { stdout } = await execAsync(
        `yt-dlp -f "bestaudio" -g "${videoUrl}"`,
        { timeout: 15000 } // 15 second timeout
      );
      
      const streamUrl = stdout.trim();
      if (!streamUrl) {
        throw new Error('No audio stream URL returned from yt-dlp');
      }

      // Extract first N minutes of audio (default 3 minutes for speed)
      // This captures most event information which is usually mentioned early
      return new Promise((resolve, reject) => {
        ffmpeg(streamUrl)
          .output(audioPath)
          .audioCodec('pcm_s16le')
          .audioFrequency(16000)
          .audioChannels(1)
          .duration(maxDurationSeconds) // Limit to first 3 minutes
          .noVideo()
          .on('end', () => {
            if (fs.existsSync(audioPath)) {
              resolve(audioPath);
            } else {
              reject(new Error('Audio file was not created'));
            }
          })
          .on('error', (err) => {
            reject(err);
          })
          .run();
      });
    } catch (error: any) {
      throw new Error(`Failed to extract audio: ${error.message}`);
    }
  }

  /**
   * Extract frames from downloaded video (for TikTok and platforms with expiring URLs)
   */
  private async extractFromDownloadedVideo(videoUrl: string, frameCount: number, extractAudio: boolean): Promise<VideoExtractionResult> {
    const platform = this.getPlatformName(videoUrl);
    console.log(`[VideoFrameExtractor] Downloading ${platform} video first (stream URLs expire)...`);
    
    // Download video using yt-dlp
    const videoPath = await this.downloadVideoWithYtDlp(videoUrl);
    
    try {
      // Get video duration
      const duration = await this.getVideoDuration(videoPath);
      console.log(`[VideoFrameExtractor] Video duration: ${duration}s`);

      // Calculate timestamps
      const timestamps = this.calculateSmartTimestamps(duration, frameCount);
      console.log(`[VideoFrameExtractor] Extracting frames at: ${timestamps.join(', ')}s`);

      // Extract frames in parallel
      const framePromises = timestamps.map(async (timestamp) => {
        try {
          const frameBase64 = await this.extractFrameAtTime(videoPath, timestamp);
          if (frameBase64) {
            return { timestamp, base64: frameBase64 };
          }
          return null;
        } catch (error: any) {
          console.warn(`[VideoFrameExtractor] Failed to extract frame at ${timestamp}s:`, error.message);
          return null;
        }
      });

      const frameResults = await Promise.all(framePromises);
      const frames = frameResults.filter((f): f is VideoFrame => f !== null);

      // Extract audio if requested
      let audioPath: string | undefined;
      if (extractAudio) {
        try {
          audioPath = await this.extractAudio(videoPath);
          console.log(`[VideoFrameExtractor] Extracted audio to: ${audioPath}`);
        } catch (error: any) {
          console.warn(`[VideoFrameExtractor] Failed to extract audio:`, error.message);
        }
      }

      // Clean up video file
      await this.cleanupFile(videoPath);

      if (frames.length === 0) {
        throw new Error('No frames could be extracted from video');
      }

      console.log(`[VideoFrameExtractor] Extracted ${frames.length} frames${audioPath ? ' and audio' : ''}`);
      return {
        frames,
        audioPath,
        duration
      };
    } catch (error: any) {
      // Clean up video file on error
      await this.cleanupFile(videoPath).catch(() => {});
      throw error;
    }
  }

  /**
   * Download video using yt-dlp (works for TikTok, YouTube, etc.)
   */
  private async downloadVideoWithYtDlp(videoUrl: string): Promise<string> {
    try {
      const videoPath = path.join(this.tempDir, `video-${Date.now()}.mp4`);
      
      // Use yt-dlp to download video (best quality, audio+video)
      const { stdout, stderr } = await execAsync(
        `yt-dlp -f "best[ext=mp4]/best" -o "${videoPath}" "${videoUrl}"`,
        { timeout: 60000 } // 60 second timeout
      );

      // yt-dlp might add extension, check if file exists
      if (fs.existsSync(videoPath)) {
        return videoPath;
      }
      
      // Try with .mp4 extension
      const pathWithExt = videoPath + '.mp4';
      if (fs.existsSync(pathWithExt)) {
        return pathWithExt;
      }
      
      // Try to find the actual downloaded file
      const files = fs.readdirSync(this.tempDir);
      const downloadedFile = files.find(f => f.startsWith('video-') && (f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mkv')));
      if (downloadedFile) {
        return path.join(this.tempDir, downloadedFile);
      }
      
      throw new Error('Downloaded video file not found');
    } catch (error: any) {
      if (error.message && error.message.includes('yt-dlp')) {
        throw new Error('yt-dlp not found. Install it with: brew install yt-dlp (macOS) or pip install yt-dlp');
      }
      throw new Error(`Failed to download video: ${error.message}`);
    }
  }

  /**
   * Download video from URL to temporary file
   */
  private async downloadVideo(videoUrl: string): Promise<string> {
    // Check if it's a YouTube URL
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      return await this.downloadYouTubeVideo(videoUrl);
    }
    
    // For other videos, try direct download
    try {
      const response = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout
        maxContentLength: 100 * 1024 * 1024, // 100MB max
      });

      const videoPath = path.join(this.tempDir, `video-${Date.now()}.mp4`);
      fs.writeFileSync(videoPath, response.data);
      
      return videoPath;
    } catch (error: any) {
      throw new Error(`Failed to download video: ${error.message}`);
    }
  }

  /**
   * Download YouTube video using yt-dlp
   */
  private async downloadYouTubeVideo(videoUrl: string): Promise<string> {
    try {
      const videoPath = path.join(this.tempDir, `video-${Date.now()}.mp4`);
      
      // Use yt-dlp to download video (best quality, audio+video)
      const { stdout, stderr } = await execAsync(
        `yt-dlp -f "best[ext=mp4]/best" -o "${videoPath}" "${videoUrl}"`,
        { timeout: 60000 } // 60 second timeout
      );

      // yt-dlp might add extension, check if file exists
      if (fs.existsSync(videoPath)) {
        return videoPath;
      }
      
      // Try with .mp4 extension
      const pathWithExt = videoPath + '.mp4';
      if (fs.existsSync(pathWithExt)) {
        return pathWithExt;
      }
      
      // Try to find the actual downloaded file
      const files = fs.readdirSync(this.tempDir);
      const downloadedFile = files.find(f => f.startsWith('video-') && f.endsWith('.mp4'));
      if (downloadedFile) {
        return path.join(this.tempDir, downloadedFile);
      }
      
      throw new Error('Downloaded video file not found');
    } catch (error: any) {
      if (error.message.includes('yt-dlp')) {
        throw new Error('yt-dlp not found. Install it with: brew install yt-dlp (macOS) or pip install yt-dlp');
      }
      throw new Error(`Failed to download YouTube video: ${error.message}`);
    }
  }

  /**
   * Get video duration in seconds
   */
  private async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        const duration = metadata.format.duration || 0;
        resolve(duration);
      });
    });
  }

  /**
   * Calculate timestamps for frame extraction
   * Smart strategy: Extract more frames at the beginning where event info is typically shown
   * - First 30 seconds: Extract frames every 5-10 seconds
   * - Rest of video: Sparse sampling
   */
  private calculateSmartTimestamps(duration: number, frameCount: number): number[] {
    const timestamps: number[] = [];
    
    // Always include start
    timestamps.push(0);
    
    // Extract frames more densely at the beginning (first 30-60 seconds)
    // Event information is usually shown early in videos
    const earlyWindow = Math.min(60, duration * 0.2); // First 60 seconds or 20% of video, whichever is smaller
    
    // Extract frames every 5-10 seconds in the early window
    for (let t = 5; t < earlyWindow; t += 10) {
      if (t < duration) {
        timestamps.push(Math.floor(t));
      }
    }
    
    // If we still need more frames, add evenly spaced ones throughout the video
    const remainingFrames = frameCount - timestamps.length;
    if (remainingFrames > 0) {
      const startTime = Math.max(earlyWindow, duration * 0.1);
      const endTime = duration * 0.9; // Avoid last 10% (often credits/black frames)
      const interval = (endTime - startTime) / (remainingFrames + 1);
      
      for (let i = 1; i <= remainingFrames; i++) {
        const timestamp = startTime + (interval * i);
        if (timestamp < duration) {
          timestamps.push(Math.floor(timestamp));
        }
      }
    }
    
    // Remove duplicates and sort, limit to reasonable number (max 15 frames)
    const uniqueTimestamps = [...new Set(timestamps)].sort((a, b) => a - b);
    return uniqueTimestamps.slice(0, 15);
  }

  /**
   * Calculate timestamps for frame extraction (legacy method, kept for compatibility)
   * Extracts frames at: start, 25%, 50%, 75%, and near end (90%)
   */
  private calculateTimestamps(duration: number, frameCount: number): number[] {
    const timestamps: number[] = [];
    
    // Always include start
    timestamps.push(0);
    
    // Add evenly spaced frames
    for (let i = 1; i < frameCount; i++) {
      const percentage = i / frameCount;
      // For last frame, use 90% instead of 100% to avoid black frames
      const timestamp = percentage >= 0.9 ? duration * 0.9 : duration * percentage;
      timestamps.push(Math.floor(timestamp));
    }
    
    // Remove duplicates and sort
    return [...new Set(timestamps)].sort((a, b) => a - b);
  }

  /**
   * Extract a single frame at a specific timestamp
   */
  private async extractFrameAtTime(videoPath: string, timestamp: number): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(this.tempDir, `frame-${timestamp}-${Date.now()}.jpg`);
      
      ffmpeg(videoPath)
        .seekInput(timestamp)
        .frames(1)
        .output(outputPath)
        .on('end', async () => {
          try {
            // Read frame as base64
            const frameBuffer = await readFile(outputPath);
            const base64 = frameBuffer.toString('base64');
            const dataUri = `data:image/jpeg;base64,${base64}`;
            
            // Clean up frame file
            await this.cleanupFile(outputPath);
            
            resolve(dataUri);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (err) => {
          // Clean up on error
          this.cleanupFile(outputPath).catch(() => {});
          reject(err);
        })
        .run();
    });
  }

  /**
   * Ensure temp directory exists
   */
  private async ensureTempDir(): Promise<void> {
    try {
      await mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, that's fine
    }
  }

  /**
   * Extract audio from video file
   */
  private async extractAudio(videoPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const audioPath = path.join(this.tempDir, `audio-${Date.now()}.wav`);
      
      ffmpeg(videoPath)
        .output(audioPath)
        .audioCodec('pcm_s16le') // WAV format, 16-bit PCM
        .audioFrequency(16000) // 16kHz sample rate (good for speech)
        .audioChannels(1) // Mono
        .noVideo()
        .on('end', () => {
          if (fs.existsSync(audioPath)) {
            resolve(audioPath);
          } else {
            reject(new Error('Audio file was not created'));
          }
        })
        .on('error', (err) => {
          reject(err);
        })
        .run();
    });
  }

  /**
   * Clean up temporary file
   */
  private async cleanupFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (error) {
      // File might not exist, that's fine
      console.warn(`[VideoFrameExtractor] Could not delete ${filePath}`);
    }
  }

  /**
   * Clean up audio file after transcription
   */
  async cleanupAudio(audioPath: string): Promise<void> {
    await this.cleanupFile(audioPath);
  }
}

