import React from 'react';
import { Text, StyleSheet, Linking, Alert } from 'react-native';
import { theme } from '../theme';

interface ClickableTextProps {
  text: string;
  style?: any;
}

/**
 * Component that renders text with clickable URLs
 * Supports both HTML links (<a href="...">...</a>) and plain URLs
 */
export function ClickableText({ text, style }: ClickableTextProps) {
  // Extract URLs from HTML links and plain text
  const parts: Array<{ text: string; url?: string; isLink: boolean }> = [];
  
  // First, extract HTML links
  const htmlLinkRegex = /<a\s+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
  let lastIndex = 0;
  let match;
  
  while ((match = htmlLinkRegex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      const beforeText = text.substring(lastIndex, match.index);
      if (beforeText) {
        // Check for plain URLs in the text before the link
        extractPlainUrls(beforeText, parts);
      }
    }
    
    // Add the link
    parts.push({
      text: match[2], // Link text
      url: match[1],  // URL
      isLink: true
    });
    
    lastIndex = htmlLinkRegex.lastIndex;
  }
  
  // Add remaining text after the last HTML link
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      extractPlainUrls(remainingText, parts);
    }
  }
  
  // If no links were found, extract plain URLs from the entire text
  if (parts.length === 0) {
    extractPlainUrls(text, parts);
  }
  
  // If still no parts, just return the text as-is
  if (parts.length === 0) {
    return <Text style={style}>{text}</Text>;
  }
  
  const handleLinkPress = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this URL');
      }
    } catch (error: any) {
      Alert.alert('Error', `Failed to open URL: ${error.message}`);
    }
  };
  
  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (part.isLink && part.url) {
          return (
            <Text
              key={index}
              style={styles.link}
              onPress={() => handleLinkPress(part.url!)}
            >
              {part.text || part.url}
            </Text>
          );
        } else {
          return <Text key={index}>{part.text}</Text>;
        }
      })}
    </Text>
  );
}

/**
 * Extract plain URLs from text and add them to parts array
 */
function extractPlainUrls(text: string, parts: Array<{ text: string; url?: string; isLink: boolean }>) {
  // URL regex pattern
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  let lastIndex = 0;
  let match;
  
  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      const beforeText = text.substring(lastIndex, match.index);
      if (beforeText) {
        parts.push({
          text: beforeText,
          isLink: false
        });
      }
    }
    
    // Add the URL as a link
    parts.push({
      text: match[1],
      url: match[1],
      isLink: true
    });
    
    lastIndex = urlRegex.lastIndex;
  }
  
  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      parts.push({
        text: remainingText,
        isLink: false
      });
    }
  }
  
  // If no URLs found, add the entire text as non-link
  if (parts.length === 0) {
    parts.push({
      text: text,
      isLink: false
    });
  }
}

const styles = StyleSheet.create({
  link: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
});

