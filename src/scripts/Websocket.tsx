import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const connectSocket = (serverUrl: string, token: string): Socket => {
    if (!socket) {
        socket = io(serverUrl, {
            transports: ['polling', 'websocket'],
            auth: {
                role: 'authorized',
                token,
            },
            autoConnect: true,
        });

        socket.on('connect', () => {
            console.log('Connected to Server ID:', socket?.id);
        });

        socket.on('connect_error', (err) => {
            console.log('Connection Error:', err.message);
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from Server');
        });
    } else if (!socket.connected) {
        socket.connect();
    }
    return socket;
};

export const getSocket = (): Socket | null => socket;

export const isSocketConnected = (): boolean => !!socket?.connected;

export const emitMessage = (event: string, data: any): void => {
    if (socket) {
        if (!socket.connected) {
            socket.connect();
        }
        socket.emit(event, data);
    } else {
        console.warn('Socket instance not initialized!');
    }
};
export const emitMessageWithcallback = async (event: string, data: any): Promise<any> => {
    if (!socket) {
        console.warn('Socket instance not initialized!');
        return "Socket instance not initialized!";
    }

    if (!socket.connected) {
        socket.connect();
    }

    return new Promise((resolve) => {
        socket!.emit(event, data, (response: { success: boolean; message?: string; reason?: string }) => {
            if (response) {
                resolve(response);
            } else {
                resolve("fail to send message to server frontend err");
            }
        });
    });
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
