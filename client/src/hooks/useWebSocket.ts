import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketMessage {
  type: string;
  permissions?: string[];
  reason?: string;
  timestamp?: string;
}

export function useWebSocket() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    if (!isAuthenticated || !user?.id) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        setIsConnected(true);
        
        // Authenticate with the server
        ws.send(JSON.stringify({
          type: 'auth',
          userId: user.id
        }));

        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === 'permissions_update') {
            console.log('📡 Received permission update:', message.reason);
            
            // Invalidate permission-related queries to force refetch
            queryClient.invalidateQueries({ queryKey: ['/api/auth/permissions'] });
            queryClient.invalidateQueries({ queryKey: ['/api/unified/users'] });
            queryClient.invalidateQueries({ queryKey: ['/api/unified/roles'] });
            
            // Show a subtle notification that permissions were updated
            if (message.reason) {
              // You could add a toast notification here if desired
              console.log('🔄 Permissions updated:', message.reason);
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect after a delay if still authenticated
        if (isAuthenticated && user?.id) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting to reconnect WebSocket...');
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  };

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      connect();
    } else {
      disconnect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [isAuthenticated, user?.id]);

  return {
    isConnected,
    connect,
    disconnect
  };
}