import React from 'react';
import { Text, View } from 'react-native';
import LiveMap, { DEFAULT_FIELD_LOCATION } from '../map/LiveMap';
import { useRealtime } from '../realtime/RealtimeContext';
import { Card, GridItem, Row, SectionTitle, useIsDesktop } from './ui';


export default function FieldMapCard() {
    const isDesktop = useIsDesktop();
    const { location, trail, isDemo, fieldMap, currentBlock } = useRealtime();
    // No GPS fix (unplugged module, no satellites, dead link) still shows the
    // field's own position rather than an empty card or a random city centre.
    const shownLocation = location ?? {
      latitude: DEFAULT_FIELD_LOCATION.latitude,
      longitude: DEFAULT_FIELD_LOCATION.longitude,
      altitude: 0,
      satellites: 0,
      deviceId: 'default-field-position',
    };

    return (
        <GridItem span={isDesktop ? 4 : 12} cols={12}>
            <View style={{ zIndex: 1, elevation: 1 }} className="w-full">
                <Card className="overflow-hidden">
                    <Row className="justify-between">
                        <SectionTitle>CURRENT LOCATION</SectionTitle>
                        {isDemo && (
                            <Text className="text-[9px] font-extrabold text-amber-600 dark:text-amber-300">DEMO DATA</Text>
                        )}
                    </Row>

                    <View className="mt-3">
                        <LiveMap location={shownLocation} trail={trail} height={192} isDefault={!location} />
                    </View>

                    <Row className="mt-2.5 justify-between">
                        <Row>
                            <Text className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{fieldMap?.name ?? 'No field map'}</Text>
                            {currentBlock && (
                                <>
                                    <Text className="text-slate-400 mx-2">•</Text>
                                    <Text className="text-xs font-extrabold text-slate-700 dark:text-slate-200">{currentBlock.name}</Text>
                                </>
                            )}
                        </Row>
                        <Text className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            {location
                                ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)} • ${location.satellites} sats`
                                : `No GPS fix • default ${DEFAULT_FIELD_LOCATION.latitude.toFixed(5)}, ${DEFAULT_FIELD_LOCATION.longitude.toFixed(5)}`}
                        </Text>
                    </Row>
                </Card>
            </View>
        </GridItem>
    );
}
