import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, ImageSourcePropType, Text, View } from 'react-native';
import { APP_ICON, APP_NAME, APP_VERSION } from '../config';

/**
 * The app icon, exactly as the navbar draws it (same asset, same look).
 * Used by the Header, the LoginModal and the loading screen so there is a
 * single source of truth for the in-app logo.
 */
export function AppLogo({ size = 30, ring = false }: { size?: number; ring?: boolean }) {
  return (
    <View
      style={
        ring
          ? {
              width: size * 1.35,
              height: size * 1.35,
              borderRadius: (size * 1.35) / 2,
              backgroundColor: '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#022c22',
              shadowOpacity: 0.25,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }
          : { alignItems: 'center', justifyContent: 'center' }
      }
    >
      <Image
        source={APP_ICON as ImageSourcePropType}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel={`${APP_NAME} logo`}
      />
    </View>
  );
}

/**
 * Loading screen — replaces the bare Expo/default splash.
 *
 *  • the icon scales in and breathes gently,
 *  • a slim brand-coloured bar walks left→right (honest: the app is working,
 *    it just does not know a percentage yet),
 *  • it fades itself out once the caller says so.
 *
 * Everything here is written with explicit styles instead of utility classes:
 * Animated.View does not receive className on web, which is what made the
 * first version of this screen render left-aligned and half off-screen.
 */
export default function AppLoadingScreen({
  label = 'Loading…',
  showVersion = true,
  onPainted,
}: {
  label?: string;
  showVersion?: boolean;
  /** called once this screen is on screen — used to hide the native splash */
  onPainted?: () => void;
}) {
  const scale = useRef(new Animated.Value(0.86)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: 1250,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      })
    ).start();
  }, [breathe, scale, slide]);

  const BAR_W = 168;
  const DOT_W = 62;

  return (
    <View
      onLayout={onPainted}
      style={{
        flex: 1,
        backgroundColor: '#043622',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
      }}
      accessibilityRole="progressbar"
      accessibilityLabel={`${APP_NAME} ${label}`}
    >
      {/* icon with a soft double halo, all explicit so it centres everywhere */}
      <View style={{ width: 240, height: 240, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 240,
            height: 240,
            borderRadius: 120,
            backgroundColor: '#0b4a31',
            opacity: 0.55,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 36,
            top: 36,
            width: 168,
            height: 168,
            borderRadius: 84,
            backgroundColor: '#065f46',
            opacity: 0.45,
          }}
        />
        <Animated.View
          style={{
            transform: [
              {
                scale: Animated.multiply(
                  scale,
                  breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] })
                ),
              },
            ],
          }}
        >
          <AppLogo size={112} />
        </Animated.View>
      </View>

      <Text
        style={{
          marginTop: 8,
          fontSize: 22,
          fontWeight: '800',
          letterSpacing: -0.3,
          color: '#d1fae5',
          textAlign: 'center',
        }}
      >
        {APP_NAME}
      </Text>
      <Text
        style={{
          marginTop: 4,
          fontSize: 13,
          fontWeight: '600',
          color: '#6ee7b7',
          textAlign: 'center',
        }}
      >
        Smart Crop Monitoring System
      </Text>

      {/* indeterminate progress bar */}
      <View style={{ marginTop: 28, alignItems: 'center' }}>
        <View
          style={{
            width: BAR_W,
            height: 4,
            borderRadius: 999,
            backgroundColor: '#022c22',
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={{
              width: DOT_W,
              height: 4,
              borderRadius: 999,
              backgroundColor: '#34d399',
              transform: [
                {
                  translateX: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-DOT_W, BAR_W],
                  }),
                },
              ],
            }}
          />
        </View>
        <Text style={{ marginTop: 12, fontSize: 12, fontWeight: '600', color: '#a7f3d0' }}>
          {label}
        </Text>
      </View>

      {showVersion && (
        <Text
          style={{
            position: 'absolute',
            bottom: 28,
            fontSize: 11,
            fontWeight: '600',
            color: '#34d399',
            opacity: 0.85,
          }}
        >
          v{APP_VERSION}
        </Text>
      )}
    </View>
  );
}
