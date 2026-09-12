import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const connectSocket = (serverUrl: string): Socket => {
    if (!socket) {
        socket = io(serverUrl, {
            // Long-polling හරහා පළමුව සම්බන්ධ වී පසුව WebSocket වෙත මාරු වීමට ඉඩ හරින්න
            transports: ['polling', 'websocket'],
            auth: {
                role: 'authorized' // සර්වර් එකේ 'authorized' role එකට මැッチ වන ලෙස 'role' යොදන්න
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