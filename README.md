# 🍽️ Shishi-Shitufi - Community Potluck Management App

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Chagai33/Shishi-ShitufiV3new)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-039BE5?logo=Firebase&logoColor=white)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-B73BFE?logo=vite&logoColor=FFD62E)](https://vitejs.dev/)

> **Shishi-Shitufi** (Hebrew for "Collaborative Friday") is a real-time, user-centric web application designed to streamline the organization of community potluck events. It replaces cumbersome spreadsheets with an intuitive, interactive interface that synchronizes data instantly across all users.

Built with a focus on seamless user experience, the app allows hundreds of community members to collaborate on food menus and equipment lists without friction, featuring a robust Admin Dashboard for event managers.

## 🎯 Live Demo

**Try the app live:** [Sample Potluck Event](https://shishi-shitufiv3v3.netlify.app/event/-OXYfRjACov3f7espZVb)

*Click the link above to join a sample potluck event and experience real-time collaboration!* 🚀

*This is a demo event - feel free to test all features including adding items, claiming assignments, and seeing live updates from other users.*

## 📋 Table of Contents

- [🚀 Key Features](#-key-features)
- [🛠 Tech Stack & Architecture](#-tech-stack--architecture)
- [📦 Installation](#-installation)
- [🚀 Usage](#-usage)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [👤 Author](#-author)

## 🚀 Key Features

This application was architected with a "user-first" philosophy, ensuring that both regular users and administrators have an intuitive and efficient experience.

### For Community Members (The User Experience):
* **Real-Time Collaboration:** Leveraging **Firebase Realtime Database**, the interface updates instantly for all users as items are added or assigned, creating a dynamic feel.
* **"Bring & Assign" in One Click:** A standout UX feature allows users to add a new item and simultaneously assign it to themselves with a single button click, removing friction.
* **Effortless Onboarding:** Users can participate instantly with a seamless anonymous authentication flow.
* **Smart Context:** The app intelligently detects new users and remembers their details locally for future sessions.

### For Administrators:
* **Centralized Admin Panel:** A dedicated, role-protected section for complete control over events, users, and menu items.
* **Bulk Import System:** Admins can bulk-import menu items from multiple sources, including **Excel (.xlsx), CSV, plain text, and preset lists**, saving significant setup time.
* **Secure Role-Based Access (RBAC):** Admin capabilities are protected by server-side Firebase Security Rules.
* **Comprehensive Management:** Full CRUD functionality for events, menu items, and user assignments.

---

## 🛠 Tech Stack & Architecture

The application is built with modern web technologies focusing on performance and developer experience:

* **Frontend:** React 18, Vite, TypeScript.
* **State Management:** **Zustand** (Selected for its lightweight footprint and scalable performance compared to Context API).
* **Styling:** Tailwind CSS (Utility-first framework for rapid UI development).
* **Backend / BaaS:** Firebase (Auth, Realtime Database, Hosting).

### 🏗️ Architecture Overview

The application follows a modern, scalable architecture with clear separation of concerns:

```
src/
├── components/          # React components organized by feature
│   ├── Admin/          # Protected management interfaces
│   ├── Events/         # Event display logic
│   ├── Auth/           # Authentication components
│   └── Common/         # Reusable UI components
├── hooks/              # Custom React hooks
├── services/           # Firebase service abstraction layer
├── store/              # Global state management (Zustand)
├── types/              # TypeScript type definitions
└── utils/              # Helper functions and utilities
```

## 📦 Installation

### Prerequisites

#### System Requirements
- **Node.js**: v18.0.0 or later
- **npm**: v8.0.0 or later (comes with Node.js)
- **Operating System**: Windows 10+, macOS 10.15+, Ubuntu 18.04+
- **RAM**: Minimum 4GB
- **Storage**: 500MB free space

#### Firebase Setup
- **Firebase Account**: Free account at [Firebase Console](https://console.firebase.google.com/)
- **Realtime Database**: Enabled in your Firebase project
- **Authentication**: Anonymous and Email/Password providers enabled

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/Chagai33/Shishi-ShitufiV3new.git
   cd Shishi-ShitufiV3new
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Create a new project at [Firebase Console](https://console.firebase.google.com/)
   - Enable **Realtime Database**
   - Configure **Authentication** with Anonymous and Email/Password providers
   - Copy your Firebase config to `src/lib/firebase.ts`

4. **Configure Security Rules**
   - Copy contents of `firebase-rules.json` to your Firebase Realtime Database Rules
   - Publish the security rules

5. **Start development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5173`

## 🚀 Usage

### For Community Members

1. **Join an Event**: Use the shared event link to access the potluck interface
2. **Browse Items**: View all food items and equipment needed for the event
3. **Claim Items**: Click "Bring & Assign" to add and assign items in one action
4. **Real-time Updates**: See live updates as others claim or add items

### For Administrators

1. **Access Admin Panel**: Navigate to the admin section with proper authentication
2. **Create Events**: Set up new potluck events with custom categories
3. **Bulk Import**: Upload menu items from Excel, CSV, or preset templates
4. **Manage Users**: Monitor participation and manage user assignments

## 🌐 Deployment

### Production Setup

The application is optimized for modern deployment pipelines:

- **Frontend**: Hosted on Netlify for high availability and fast edge caching
- **Backend**: Serverless Firebase services (Auth, Realtime Database)
- **CDN**: Automatic asset optimization and global distribution

### Environment Variables

Create a `.env.local` file with your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=your_project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
```

## 📜 Available Scripts

After installation, you can run these commands:

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build locally
npm run lint     # Run ESLint for code quality checks
```

## 📸 Screenshots

### Main Event View
![Main Event View](https://via.placeholder.com/800x600.png?text=Main+Event+View)

### Admin Dashboard
![Admin Dashboard](https://via.placeholder.com/800x600.png?text=Admin+Dashboard)

### Bulk Import Feature
![Bulk Import](https://via.placeholder.com/800x600.png?text=Bulk+Import+Feature)

## 🔧 Troubleshooting

### Common Issues

**Firebase Connection Issues:**
- Verify your Firebase configuration in `src/lib/firebase.ts`
- Ensure your Firebase project has Realtime Database enabled
- Check that security rules are properly configured

**Build Errors:**
- Run `npm install` to ensure all dependencies are installed
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

**Authentication Problems:**
- Confirm Anonymous authentication is enabled in Firebase Console
- Check browser console for authentication errors

**Performance Issues:**
- Ensure you're using a modern browser
- Check network connectivity for real-time updates

## 🚀 Roadmap

### Upcoming Features
- [ ] **Mobile App**: React Native version for iOS/Android
- [ ] **Push Notifications**: Real-time alerts for event updates
- [ ] **Advanced Analytics**: Detailed participation statistics
- [ ] **Recipe Integration**: Link items to recipes and nutritional info
- [ ] **Multi-language Support**: Hebrew, English, and additional languages
- [ ] **Offline Mode**: Basic functionality without internet connection

### Version History
- **v1.0.0** (Current): Core potluck management functionality
  - Real-time collaboration
  - Admin dashboard
  - Bulk import features
  - Mobile-responsive design

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow the existing code style and TypeScript conventions
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

## 📄 License

This project is licensed under the MIT License.

## 🐛 Issues & Support

- 🐛 [Report a Bug](https://github.com/Chagai33/Shishi-ShitufiV3new/issues)
- 💡 [Request a Feature](https://github.com/Chagai33/Shishi-ShitufiV3new/issues)
- 📖 [Documentation](https://github.com/Chagai33/Shishi-ShitufiV3new/wiki)

## 👤 Author

**Chagai Yechiel** - IT Operations & Automation Developer

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/chagai-yechiel/)

---

<p align="center">
  Made with ❤️ for community collaboration
</p>