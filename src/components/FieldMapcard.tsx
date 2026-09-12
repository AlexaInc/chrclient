import React from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Card, GridItem, Row, SectionTitle, useIsDesktop } from './ui';

export default function FieldMapCard() {
    const isDesktop = useIsDesktop();

    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);

    const translateX = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);

    const translateY = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const pinchGesture = Gesture.Pinch()
        .onUpdate((event) => {
            scale.value = savedScale.value * event.scale;
        })
        .onEnd(() => {
            if (scale.value < 1) {
                scale.value = withSpring(1);
                savedScale.value = 1;
                translateX.value = withSpring(0);
                savedTranslateX.value = 0;
                translateY.value = withSpring(0);
                savedTranslateY.value = 0;
            } else {
                savedScale.value = scale.value;
            }
        });

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            if (scale.value > 1) {
                translateX.value = savedTranslateX.value + event.translationX;
                translateY.value = savedTranslateY.value + event.translationY;
            }
        })
        .onEnd(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        });

    const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { translateX: translateX.value },
            { translateY: translateY.value },
        ],
    }));

    return (
        <GridItem span={isDesktop ? 4 : 12} cols={12}>
            <View style={{ zIndex: 1, elevation: 1 }} className="w-full">
                <Card className="overflow-hidden">
                    <SectionTitle>CURRENT LOCATION</SectionTitle>

                    <View className="w-full h-48 overflow-hidden rounded-lg mt-3 border border-slate-200 bg-slate-100 justify-center items-center">
                        <GestureDetector gesture={composedGesture}>
                            <Animated.View className="w-full h-full justify-center items-center">
                                <Animated.Image
                                    source={require('../../assets/images/field-map.jpg')}
                                    className="w-full h-full"
                                    style={animatedStyle}
                                    resizeMode="contain"
                                />
                            </Animated.View>
                        </GestureDetector>
                    </View>

                    <Row className="mt-2.5">
                        <Text className="text-xs font-extrabold text-slate-800">Field A</Text>
                        <Text className="text-slate-400 mx-2">•</Text>
                        <Text className="text-xs font-extrabold text-slate-700">Block 2</Text>
                    </Row>
                </Card>
            </View>
        </GridItem>
    );
}