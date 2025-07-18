# Technology Stack

## Framework & Platform
- **React Native** with **Expo SDK 53**
- **TypeScript** for type safety
- **Expo Router** for file-based navigation
- Target platforms: iOS, Android, Web

## Key Dependencies
- **Navigation**: `@react-navigation/native`, `@react-navigation/bottom-tabs`
- **Icons**: `lucide-react-native`, `@expo/vector-icons`
- **UI Components**: `expo-blur`, `expo-linear-gradient`, `react-native-svg`
- **Device Features**: `expo-camera`, `expo-haptics`, `expo-web-browser`
- **Utilities**: `react-native-gesture-handler`, `react-native-reanimated`

## Development Commands
```bash
# Start development server (with telemetry disabled)
npm run dev

# Build for web
npm run build:web

# Lint code
npm run lint

# Mobile builds
expo build:ios
expo build:android
```

## Configuration
- **TypeScript**: Strict mode enabled with path aliases (`@/*`)
- **Expo**: New Architecture enabled, typed routes experimental feature
- **Build**: Metro bundler for web with single output
- **Prettier**: Code formatting configured

## Architecture Patterns
- Service layer pattern for business logic (`services/`)
- Custom hooks for framework initialization
- Singleton pattern for AI empathy service
- Interface-based type definitions
- Component composition with props interfaces

## Code Style
- Functional components with TypeScript interfaces
- Async/await for asynchronous operations
- StyleSheet.create for component styling
- Consistent naming: camelCase for variables, PascalCase for components