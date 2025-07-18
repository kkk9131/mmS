# Project Structure

## Root Directory
```
mamapace/
├── app/                 # Expo Router pages
├── components/          # Reusable UI components
├── services/           # Business logic & API services
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
├── assets/             # Static assets (images, fonts)
└── .kiro/              # Kiro AI assistant configuration
```

## App Directory (Expo Router)
```
app/
├── _layout.tsx         # Root layout with Stack navigation
├── login.tsx           # Authentication screen
├── (tabs)/             # Tab navigation group
│   ├── _layout.tsx     # Tab bar configuration
│   ├── index.tsx       # Home timeline
│   ├── notifications.tsx
│   ├── post.tsx        # Post creation
│   └── you.tsx         # Profile/settings
├── chat-list.tsx       # Direct messages
├── chat.tsx            # Individual chat
├── complaint-room.tsx  # Complaint/support room
├── follow-list.tsx     # Following/followers
├── liked-posts.tsx     # User's liked posts
├── post-history.tsx    # User's post history
├── profile-edit.tsx    # Profile editing
├── profile.tsx         # User profile view
├── room.tsx            # Tag-based chat rooms
└── +not-found.tsx      # 404 page
```

## Components
- **PostCard.tsx**: Main post display component with interactions
- **AIEmpathyBot.tsx**: AI response component
- **Sidebar.tsx**: Navigation sidebar component

## Services
- **aiEmpathyService.ts**: AI empathy response generation (singleton)
- **safetyService.ts**: Content moderation and safety features

## Types
- **index.ts**: Central type definitions (Post, Room, User, etc.)

## Naming Conventions
- **Files**: kebab-case for screens, PascalCase for components
- **Components**: PascalCase with descriptive names
- **Services**: camelCase with Service suffix
- **Types**: PascalCase interfaces
- **Hooks**: camelCase starting with 'use'

## File Organization Rules
- One component per file
- Co-locate related styles using StyleSheet.create
- Group related functionality in services
- Keep types centralized in types/index.ts
- Use path aliases (@/) for imports