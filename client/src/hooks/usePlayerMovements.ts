import { useEffect } from 'react';
import { useCameraFocus } from '@/stores/camera-focus';
import { BODIES } from '@/components/solar-system/bodies';

export interface PlayerMovementEvent {
  type: 'player_moved' | 'connected';
  userId?: number;
  bodyId?: number;
  bodyName?: string;
  timestamp: number;
}

/**
 * Real-time player movement tracking via Server-Sent Events.
 * 
 * Subscribes to /api/events and updates camera focus when players
 * travel between bodies in Telegram. Auto-reconnects on connection loss.
 * 
 * @param enabled - Enable/disable SSE subscription (default: true)
 * @param onMovement - Optional callback for custom movement handling
 */
export function usePlayerMovements(
  enabled: boolean = true,
  onMovement?: (event: PlayerMovementEvent) => void
) {
  useEffect(() => {
    if (!enabled) return;

    const events = new EventSource('/api/events');
    
    events.addEventListener('message', (e) => {
      try {
        const data: PlayerMovementEvent = JSON.parse(e.data);
        
        if (data.type === 'connected') {
          console.log('[SSE] Connected to SOLARIS Network real-time sync');
          return;
        }
        
        if (data.type === 'player_moved' && data.bodyName) {
          console.log(
            `[SSE] Player ${data.userId} traveled to ${data.bodyName}`
          );
          
          // Call custom handler if provided
          if (onMovement) {
            onMovement(data);
          }
          
          // Resolve bodyName to bodyId (case-insensitive name match)
          const body = BODIES.find(
            b => b.name.toLowerCase() === data.bodyName!.toLowerCase()
          );
          
          if (body) {
            // Auto-focus camera on movements (only if not manually focused)
            const { isFocused, focus } = useCameraFocus.getState();
            if (!isFocused) {
              focus(body.id);
            }
          } else {
            console.warn('[SSE] Unknown body name:', data.bodyName);
          }
        }
      } catch (err) {
        console.warn('[SSE] Failed to parse event:', err);
      }
    });
    
    events.onerror = (err) => {
      console.warn('[SSE] Connection error, reconnecting...', err);
      // EventSource auto-reconnects, no manual action needed
    };
    
    return () => {
      console.log('[SSE] Disconnecting from SOLARIS Network');
      events.close();
    };
  }, [enabled, onMovement]);
}
