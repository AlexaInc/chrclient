import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const connectSocket = (serverUrl: string): Socket => {
    if (!socket) {
        socket = io(serverUrl, {
            transports: ['websocket'],
            auth:{key:'authorized'},
            autoConnect: true,
        });

        socket.on('connect', () => {
            console.log('(Connected):', socket?.id);
        });

        socket.on('disconnect', () => {
            console.log('(Disconnected)');
        });
    }
    return socket;
};

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