# Auth Pages Redesign Spec
**Date:** 2026-04-16  
**Scope:** Login & Register pages with choice screen, Google OAuth, real-time validation, password strength indicator  
**Aesthetic:** Professional & Elegant with smooth transitions and sophisticated design

---

## Overview

Redesign the authentication flow from a basic single-form experience to a two-step, polished flow:
1. **Choice Screen** — User selects "Sign In" or "Create Account"
2. **Auth Form** — Email/password or Google OAuth

This redesign includes real-time validation, password strength feedback, smooth animations, and full light/dark theme support with red accent color.

---

## Architecture

### Component Structure

```
AuthPage (orchestrator)
├── ChoiceScreen
│   ├── SignInCard
│   └── CreateAccountCard
├── LoginForm
│   ├── InputField
│   ├── PasswordStrengthBar (N/A for login)
│   └── GoogleOAuthButton
└── RegisterForm
    ├── InputField
    ├── PasswordStrengthBar
    └── GoogleOAuthButton
```

**Component Responsibilities:**
- **AuthPage:** Manages state (currentStep, form mode), orchestrates transitions, handles session setup
- **ChoiceScreen:** Presents two cards, animates in on load, handles mode selection
- **LoginForm:** Email + password fields, Google OAuth, real-time validation, form submission
- **RegisterForm:** Email + password + name fields, password strength bar, real-time validation, form submission
- **InputField:** Shared input component with focus states, validation feedback, icon support
- **PasswordStrengthBar:** Displays strength level (Weak/Fair/Good/Strong) with color gradient and helper text
- **GoogleOAuthButton:** Shared button for OAuth with consistent styling across login/register

### State Management

**AuthPage state:**
```typescript
- currentStep: 'choice' | 'login' | 'register'
- loading: boolean
- error: string | null
```

**Form state (per form component):**
```typescript
- email: string
- password: string
- name: string (register only)
- validationErrors: { [field]: string | null }
- isDirty: { [field]: boolean } // Track which fields user has interacted with
```

**Real-time validation:**
- Validate on change (after field is dirty)
- Show errors only for dirty fields
- Update validation errors object in real-time
- Disable submit until form is fully valid

---

## Detailed Designs

### Step 1: Choice Screen

**Visual Layout:**
- Full-screen centered container
- Ambient glow in background (red gradient, 0.07 opacity, blurred)
- Two cards side-by-side, equal width
- Mobile: Stack vertically

**Card Design (each):**
- Background: Glass effect with `var(--glass-bg)` and `var(--glass-border)`
- Padding: 48px vertical, 32px horizontal
- Border radius: 16px
- Border: 1px solid `var(--glass-border)`
- Content:
  - Icon (TrendingUp or User icon, 32px, color `var(--color-info)` red)
  - Heading: "Sign In" or "Create Account" (18px, bold, primary text)
  - Description: Brief helper text (14px, secondary text)
  - Button: Full-width, red primary button

**Interactions:**
- On hover: 
  - Border color → `var(--border-focus)` red glow
  - Shadow lift: `0 8px 24px rgba(0,0,0,0.2)` (dark) or `0 4px 12px rgba(0,0,0,0.08)` (light)
  - Cursor: pointer
- On click: Animate form in
- Animations:
  - Page load: Each card fades in with slight scale (opacity 0→1, scale 0.95→1, stagger 100ms)
  - Transition to form: Cards fade out, form slides in from right (200ms)

---

### Step 2: Login Form

**Layout:**
- Centered card, max-width 420px
- Header:
  - Back button (top-left, arrow icon, text "Back", hover effect)
  - Title: "Welcome back" (20px, bold)
  - Subtitle: "Sign in to your TradeMAX dashboard" (14px, secondary text)
- Form fields (stacked, 12px gap):
  - Email input
  - Password input
  - Submit button (full-width, red primary)
  - OR divider
  - Google OAuth button
- Error banner: Red accent border, slides in from top on API error

**Input Fields:**
- Each input wrapped in InputField component
- Structure:
  - Icon (left, 16px, secondary text color)
  - Text input (flex-grow)
  - Validation icon (right, appears when field is valid/invalid)
- Focus state:
  - Border color: `var(--border-focus)` red
  - Shadow: `0 0 0 3px rgba(239, 68, 68, 0.1)`
  - Icon color: `var(--color-info)` red
  - Transition: 150ms ease
- Validation feedback:
  - Invalid (red X icon, appears after user types): Show error text below field in red
  - Valid (green check icon): Show subtle positive feedback
  - Only show feedback if field is dirty (user has interacted)

**Validation Rules (Login):**
- Email: Required, must be valid email format
- Password: Required, min 1 character (just checking it's not empty)

**Google OAuth Button:**
- Style: Secondary/ghost button (border, not filled)
- Text: "Continue with Google" + icon
- Width: Full-width (matches submit button)
- On click: Trigger OAuth flow

**Animations:**
- Form slide-in: 300ms ease-out, x: 100px → 0px, opacity 0 → 1
- Back button click: Slide-out, form slides left, choice screen fades in
- Validation icons: Fade in 150ms
- Field focus: Border/shadow transition 150ms
- Submit button: Click → loading state with spinner

---

### Step 3: Register Form

**Layout:** Same as login form, but with additional elements:
- Header: Same structure, title "Create account"
- Form fields (stacked, 12px gap):
  - Name input (with validation: required, min 2 chars)
  - Email input
  - Password input + PasswordStrengthBar below
  - Submit button (full-width)
  - OR divider
  - Google OAuth button
- Error banner: Same as login

**Password Strength Bar:**
- Appears below password input, only on register
- Structure:
  - Bar: 4px height, background `var(--border)`, border radius 99px
  - Fill: Animated gradient based on strength
    - Weak (0-30%): Red to orange gradient
    - Fair (30-60%): Orange to yellow gradient
    - Good (60-85%): Yellow to green gradient
    - Strong (85-100%): Green gradient
  - Fill width: Animates as user types (200ms transition)
  - Strength text: Below bar, updates in real-time
    - "Weak password" / "Fair password" / "Good password" / "Strong password"
    - Color matches bar color
  - Helper text: "Add numbers and symbols for a stronger password" (when weak)

**Password Strength Algorithm:**
```
- Length: 0-20 points
- Uppercase: 0-10 points
- Lowercase: 0-10 points
- Numbers: 0-10 points
- Symbols: 0-20 points
- Special cases: Bonus/penalty for patterns
Total: 0-100 points
- 0-30: Weak
- 30-60: Fair
- 60-85: Good
- 85-100: Strong
```

**Validation Rules (Register):**
- Name: Required, min 2 characters, max 50 characters
- Email: Required, valid email format
- Password: Required, min 8 characters (suggest strong, but allow fair)

**Animations:**
- Same as login form
- Name field: Animates in when register mode is selected (fade + slide up, 300ms)

---

## Interaction Flows

### Flow 1: Login → Submit → Dashboard
1. User arrives at choice screen
2. Clicks "Sign In" → Form slides in
3. Enters email, sees validation feedback in real-time
4. Enters password, sees validation feedback
5. Clicks submit → Loading state (spinner on button)
6. Success: Navigates to dashboard
7. Error: Error banner slides in at top, user can retry

### Flow 2: Register → Submit → Dashboard
1. User arrives at choice screen
2. Clicks "Create Account" → Form slides in
3. Enters name, sees validation feedback
4. Enters email, sees validation feedback
5. Enters password, sees real-time strength bar updating
6. Clicks submit → Loading state
7. Success: Navigates to dashboard
8. Error: Error banner slides in (e.g., "Email already exists"), user can retry

### Flow 3: Back to Choice
- User on login/register form
- Clicks back button
- Form slides out left, choice screen fades back in
- User can select different option

### Flow 4: Google OAuth
- User clicks "Continue with Google"
- OAuth window/redirect happens
- On success: Navigates to dashboard
- On error: Error banner appears with message

---

## Visual Details

### Colors & Theming
- **Primary action:** Red accent `#EF4444` (dark) / `#DC2626` (light)
- **Focus states:** `var(--border-focus)` red with rgba shadow
- **Valid field:** Green (use `var(--color-profit)`)
- **Invalid field:** Red (use `var(--color-loss)`)
- **Backgrounds:** Use `var(--bg-base)`, `var(--bg-surface)`, `var(--glass-bg)`
- **Text:** Use `var(--text-primary)`, `var(--text-secondary)`, `var(--text-tertiary)`
- **Borders:** Use `var(--border)`, `var(--border-strong)`, `var(--border-focus)`

### Spacing & Sizing
- Card padding: 48px vertical, 32px horizontal
- Form field gap: 12px
- Form field height: 40-44px (with icon padding)
- Input icon size: 16px
- Button height: 40px
- Button border radius: 8px
- Card border radius: 16px

### Typography
- Heading: 20px, 600 weight, `var(--text-primary)`
- Subheading: 14px, 500 weight, `var(--text-secondary)`
- Body: 14px, 400 weight, `var(--text-primary)`
- Helper text: 12px, 400 weight, `var(--text-tertiary)`
- Error text: 13px, 400 weight, `var(--color-loss)`

### Animations & Transitions
- All transitions: 150ms-300ms, `ease-out` easing
- Slide animations: 300ms
- Fade animations: 200ms
- Validation icons: 150ms fade-in
- Password strength bar: 200ms width transition
- No bouncy/playful animations (professional aesthetic)

---

## Error Handling

**Form Validation Errors:**
- Show inline below field in red text (12px)
- Only show for dirty fields
- Clear when user starts typing to correct
- Messages:
  - Email: "Invalid email address" or "Email already exists" (register)
  - Password: "Password must be at least 8 characters"
  - Name: "Name must be at least 2 characters"

**API/Submission Errors:**
- Top banner with red border and red text
- Specific messages:
  - "EMAIL_EXISTS": "An account with this email already exists"
  - "INVALID_CREDENTIALS": "Invalid email or password"
  - Generic: Use error message from server
- Auto-dismiss after 5 seconds or on next submit attempt
- Slide-in animation from top

**Network/OAuth Errors:**
- Same banner treatment
- Messages: "OAuth authentication failed. Please try again."

---

## Accessibility & Responsive Design

### Mobile
- Choice screen: Cards stack vertically
- Form: Padding reduces to 32px horizontal, 40px vertical
- Buttons: Full-width always
- Touch targets: Min 44px height
- Form field height: 44px (larger for touch)

### Keyboard Navigation
- Tab order: Logo → Back button → Form fields → Submit button
- Enter on form field: Submit form if valid
- Esc on form: Return to choice screen

### Labels & ARIA
- Each input has implicit label via placeholder
- Form has `role="form"`
- Error messages have `role="alert"` for screen readers
- Password strength bar has `aria-live="polite"` to announce changes

---

## Testing Strategy

**Unit Tests:**
- PasswordStrengthBar: Strength calculation algorithm
- InputField: Validation state management
- Form validation: Each rule independently

**Integration Tests:**
- LoginForm: Submit valid/invalid data, error handling
- RegisterForm: Submit valid/invalid data, password strength updates
- AuthPage: Navigation between screens, back button, theme persistence

**Visual/Animation Tests:**
- Verify animations play smoothly (manual testing)
- Verify transitions between screens don't skip/stutter
- Theme toggle: Verify colors update in real-time

---

## Implementation Notes

- Use `framer-motion` for all animations (existing dependency)
- Leverage existing `InputField` component, extend as needed
- Use CSS variables for all colors (automatic light/dark support)
- Tailwind for layout and spacing
- Password strength calculation: Pure JS function, no external library needed
- Google OAuth: Use existing OAuth library/setup from project

---

## Files to Modify/Create

**New files:**
- `src/renderer/pages/AuthPage.tsx` — Refactor into orchestrator + step components
- `src/renderer/components/ChoiceScreen.tsx` — New
- `src/renderer/components/LoginForm.tsx` — New
- `src/renderer/components/RegisterForm.tsx` — New
- `src/renderer/components/PasswordStrengthBar.tsx` — New

**Modify:**
- `src/renderer/components/InputField.tsx` — Add validation feedback (icons, error text)

**No changes:**
- CSS variables, tailwind config, theme system (already supports this)
