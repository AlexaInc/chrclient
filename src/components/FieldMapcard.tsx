import React from 'react';
import { Text, View } from 'react-native';
import LiveMap from '../map/LiveMap';
import { useRealtime } from '../realtime/RealtimeContext';
import { Card, GridItem, Row, SectionTitle, useIsDesktop } from './ui';

/**
 * Dashboard "Current Location" card — now a live Leaflet map fed by
 * realtime `message.upsert` { Type: 'location' } fixes (real socket data,
 * or the demo simulator when logged in as demo/demo).
 */
export default function FieldMapCard() {
    const isDesktop = useIsDesktop();
    const { location, trail, isDemo } = useRealtime();

    return (
        <GridItem span={isDesktop ? 4 : 12} cols={12}>
            <View style={{ zIndex: 1, elevation: 1 }} className="w-full">
                <Card className="overflow-hidden">
                    <Row className="justify-between">
                        <SectionTitle>CURRENT LOCATION</SectionTitle>
                        {isDemo && (
                            <Text className="text-[9px] font-extrabold text-amber-600">DEMO DATA</Text>
                        )}
                    </Row>

                    <View className="mt-3">
                        <LiveMap location={location} trail={trail} height={192} />
                    </View>

                    <Row className="mt-2.5 justify-between">
                        <Row>
                            <Text className="text-xs font-extrabold text-slate-800">Field A</Text>
                            <Text className="text-slate-400 mx-2">•</Text>
                            <Text className="text-xs font-extrabold text-slate-700">Block 2</Text>
                        </Row>
                        <Text className="text-[10px] font-bold text-slate-500">
                            {location
                                ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)} • ${location.satellites} sats`
                                : 'Waiting for GPS…'}
                        </Text>
                    </Row>
                </Card>
            </View>
        </GridItem>
    );
}
