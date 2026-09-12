import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Connect the Socket.IO client using the JWT/session token obtained from
 * POST {SERVER_URL}/auth/login. The socket is NOT connected until login
 * succeeds — call this only with a valid token.
 */
export const connectSocket = (serverUrl: string, token: string): Socket => {
    if (!socket) {
        socket = io(serverUrl, {
            transports: ['websocket'],
            auth: { token },
            autoConnect: true,
        });

        socket.on('connect', () => {
            console.log('(Connected):', socket?.id);
        });

        socket.on('connect_error', (err) => {
            console.warn('(Connect error):', err.message);
        });

        socket.on('disconnect', () => {
            console.log('(Disconnected)');
        });
    }
    return socket;
};

export const getSocket = (): Socket | null => socket;

export const isSocketConnected = (): boolean => !!socket?.connected;

export const emitMessage = (event: string, data: any): void => {
    if (socket && socket.connected) {
        socket.emit(event, data);
    } else {
        console.warn('not connected socket');
    }
};

export const addEventListener = (event: string, callback: (data: any) => void): void => {
    if (socket) {
        socket.on(event, callback);
    }
};

export const removeEventListener = (event: string): void => {
    if (socket) {
        socket.off(event);
    }
};

export const disconnectSocket = (): void => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
