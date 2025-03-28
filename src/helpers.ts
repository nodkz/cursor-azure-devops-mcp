/**
 * Helper function to safely handle response serialization
 * preventing circular reference errors
 */
export function safeResponse(result: any): string {
  // If the result is already a string, return it
  if (typeof result === 'string') {
    return result;
  }

  // Special case for file content responses with nested content property
  if (result && typeof result.content === 'string') {
    try {
      // Try to parse the content string which might be a stringified object with circular refs
      const parsedContent = JSON.parse(result.content);

      // If parsing succeeded and content contains buffer data, extract what we need
      if (parsedContent && parsedContent._readableState && parsedContent._readableState.buffer) {
        // Extract buffer data and convert to actual content when possible
        const bufferData = parsedContent._readableState.buffer;

        // If we have buffer data with a "data" property, try to convert it to actual content
        if (
          Array.isArray(bufferData) &&
          bufferData.length > 0 &&
          bufferData[0].type === 'Buffer' &&
          Array.isArray(bufferData[0].data)
        ) {
          try {
            // Convert buffer data to actual content
            const bufferBytes = Buffer.from(bufferData[0].data);

            // Determine if it's likely text content based on content type or binary detection
            const isLikelyText =
              !result.isBinary &&
              (!result.contentType ||
                result.contentType.includes('text') ||
                result.contentType.includes('json') ||
                result.contentType.includes('html') ||
                result.contentType.includes('xml') ||
                result.contentType.includes('javascript') ||
                result.contentType.includes('typescript'));

            // Return structured response with both the converted content and metadata
            return JSON.stringify(
              {
                content: isLikelyText
                  ? bufferBytes.toString('utf-8')
                  : '[Binary content - displaying first 1000 bytes as hex]',
                hexContent: isLikelyText ? null : bufferBytes.toString('hex').substring(0, 2000),
                isBinary: result.isBinary,
                contentType: result.contentType,
                size: result.size || bufferBytes.length,
                length: result.length || bufferBytes.length,
                position: result.position || 0,
              },
              null,
              2
            );
          } catch (bufferError) {
            // Fall back to returning the raw buffer data
            return JSON.stringify(
              {
                buffer: bufferData,
                error: 'Failed to convert buffer to content',
                errorDetails: bufferError instanceof Error ? bufferError.message : 'Unknown error',
                size: result.size || 0,
                length: result.length || 0,
                position: result.position || 0,
                contentType: result.contentType,
                isBinary: result.isBinary,
              },
              null,
              2
            );
          }
        }

        // Fallback to original approach if buffer format is different
        const sanitizedContent = {
          buffer: bufferData,
          size: result.size || 0,
          length: result.length || 0,
          position: result.position || 0,
          contentType: result.contentType,
          isBinary: result.isBinary,
          error: result.error,
        };
        return JSON.stringify(sanitizedContent, null, 2);
      }
    } catch (_parseError) {
      // If parsing fails, the content might not be JSON or might be corrupted
      // Continue with the normal safe stringify process
    }
  }

  try {
    // Try to JSON stringify normally first
    return JSON.stringify(result, null, 2);
  } catch (error) {
    // If normal stringify fails, use a more robust approach
    const seen = new WeakSet();
    try {
      return JSON.stringify(
        result,
        (key, value) => {
          // Skip these problematic keys that often cause circular references
          if (
            key === '_httpMessage' ||
            key === 'socket' ||
            key === 'connection' ||
            key === 'agent' ||
            key === 'parser' ||
            key === 'client' ||
            key === '_events' ||
            key === '_eventsCount' ||
            key === '_readableState' ||
            key === '_writableState'
          ) {
            return '[Circular]';
          }

          // Special handling for Buffer data - convert to string if possible
          if (
            key === 'buffer' &&
            Array.isArray(value) &&
            value.length > 0 &&
            value[0].type === 'Buffer'
          ) {
            try {
              const bufferBytes = Buffer.from(value[0].data);
              // Return converted text for smaller buffers, hexdump for larger ones
              if (bufferBytes.length < 10000) {
                return {
                  content: bufferBytes.toString('utf-8'),
                  bytesLength: bufferBytes.length,
                };
              } else {
                return {
                  content: '[Large buffer - first 1000 bytes shown]',
                  hexContent: bufferBytes.toString('hex').substring(0, 2000),
                  bytesLength: bufferBytes.length,
                };
              }
            } catch (_bufferErr) {
              // Return truncated buffer array if conversion fails
              return value.slice(0, 1000);
            }
          }

          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return '[Circular]';
            }
            seen.add(value);
          }
          return value;
        },
        2
      );
    } catch (_secondError) {
      // If all else fails, convert to a simple error message with more details
      return JSON.stringify({
        error: 'Failed to serialize response',
        message: error instanceof Error ? error.message : 'Unknown error',
        type: result ? typeof result : 'undefined',
        hasContent: result && result.content ? true : false,
        contentType: result && result.contentType ? result.contentType : 'unknown',
      });
    }
  }
}
