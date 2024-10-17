# Tickr

Tickr is a modern, user-friendly time-tracking application designed to help users manage and monitor their various obligations efficiently. Whether you're balancing work, study, exercise, or personal projects, Tickr provides an intuitive interface to track your time and progress towards your goals.

## Features

- **Google Sign-In**: Secure and easy authentication using Google accounts.
- **Obligation Management**: Create, edit, and delete custom obligations.
- **Time Tracking**: Start and stop timers for each obligation with a single click.
- **Weekly Goals**: Set and track weekly time goals for each obligation.
- **Dashboard Overview**: 
  - Visual weekly chart showing time spent on each obligation.
  - Total time tracked for the week.
  - Number of active obligations.
- **Detailed Obligation View**:
  - Large, circular timer display.
  - Progress bar showing current progress towards the weekly goal.
  - List of recent time entries.
- **Automatic Weekly Reset**: Time entries are automatically reset at the start of each week (Monday at 12:01 AM).
- **Responsive Design**: Works seamlessly on both desktop and mobile devices.

## Technology Stack

- **Frontend**: React with Next.js
- **State Management**: React Hooks
- **Authentication**: Firebase Authentication
- **Database**: Firebase Firestore
- **Styling**: Tailwind CSS
- **Charts**: Recharts library
- **Icons**: Lucide React

## Getting Started

1. Clone the repository:
   ```
   git clone https://github.com/your-username/tickr.git
   ```

2. Install dependencies:
   ```
   cd tickr
   npm install
   ```

3. Set up Firebase:
   - Create a Firebase project and enable Google Authentication.
   - Set up Firestore database.
   - Add your Firebase configuration to `lib/firebase.ts`.

4. Run the development server:
   ```
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

- `/app`: Next.js app router and main page components
- `/components`: Reusable React components
- `/lib`: Utility functions and Firebase configuration
- `/public`: Static assets

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Next.js team for the amazing React framework
- Firebase team for authentication and database services
- Recharts team for the charting library
- Lucide for the beautiful icons
