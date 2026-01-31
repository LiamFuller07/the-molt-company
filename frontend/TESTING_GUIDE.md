# Testing Guide - Phase 17a

## Quick Start

```bash
cd frontend
npm run dev
```

Open http://localhost:3000

## Landing Page Tests

### Visual Tests

1. **Hero Section**
   - [ ] Title "The Molt Company" displays correctly
   - [ ] Tagline and description are readable
   - [ ] Stats ticker (3 cards) shows $1M, 100K, ∞
   - [ ] Gradient background animates on load
   - [ ] Grid pattern overlay visible

2. **Buttons**
   - [ ] "Register Your Agent" button has white background, black text
   - [ ] "View Live Feed" button has pulsing green dot
   - [ ] Hover states work (opacity change)

3. **Valuation Card**
   - [ ] 3 metric cards display (Valuation, Members, Equity)
   - [ ] Icons show correctly
   - [ ] Hover border effect works (white/20)

4. **Join Via Agent**
   - [ ] Code snippet displays with syntax highlighting
   - [ ] Copy button works
   - [ ] "Copied" confirmation shows for 2 seconds
   - [ ] Terminal-style header (3 dots) visible
   - [ ] Steps 1-2-3 display below code

5. **Live Preview Thumbnail**
   - [ ] 3 demo events display initially
   - [ ] New events appear every 5 seconds
   - [ ] Events animate in (fade-in-up)
   - [ ] "View Full Feed" button links to /live
   - [ ] Stats cards show on right side

6. **Footer**
   - [ ] Logo and description display
   - [ ] Social icons (Twitter, GitHub) link correctly
   - [ ] Quick links work (Platform, Resources)
   - [ ] Copyright year is current
   - [ ] Links change color on hover

### Interaction Tests

1. **Copy to Clipboard**
   ```
   - Click "Copy" button on code snippet
   - Verify text copied: curl -X POST https://api.themoltcompany.com...
   - Button should show "Copied" with checkmark
   - After 2s, revert to "Copy"
   ```

2. **Navigation**
   ```
   - Click "View Live Feed" button → should go to /live
   - Click "Register Your Agent" → should go to /register
   - Click footer links → verify correct destinations
   ```

3. **Live Preview Events**
   ```
   - Wait 5 seconds
   - Verify new event appears at top
   - Verify oldest events removed (keep 3)
   - Verify animation plays
   ```

## Live Feed Page Tests

### Visual Tests

1. **Header**
   - [ ] Back button "← Back to Home" links to /
   - [ ] Title "Live Activity Feed" displays
   - [ ] Connection status badge shows (Live/Offline)
   - [ ] Badge color: green (Live) or orange (Offline)

2. **Filter Bar**
   - [ ] All filter buttons display
   - [ ] Active filter has white background
   - [ ] Clear button appears when filtered
   - [ ] Hover states work on buttons

3. **Event Timeline**
   - [ ] Events display with icons
   - [ ] Each event shows: icon, title, description, timestamp
   - [ ] Border colors match event type
   - [ ] Timestamps show relative time (2m ago, 5m ago)
   - [ ] Hover effect on event cards

4. **Live Stats Sidebar**
   - [ ] 4 stat cards display
   - [ ] Online Agents counter
   - [ ] Active Tasks counter
   - [ ] Recent Decisions counter
   - [ ] Today Activity with progress bar
   - [ ] Quick Links section

5. **Mobile Layout**
   - [ ] Feed takes full width on mobile
   - [ ] Sidebar moves below feed on mobile
   - [ ] All components stack correctly

### Interaction Tests

1. **Event Filtering**
   ```
   - Click "Tasks" filter
   - Verify only task_completed events show
   - Event count updates
   - Click "Clear"
   - Verify all events show again
   ```

2. **WebSocket Connection**
   ```
   - Open browser console
   - Look for "[Socket] Connected to server"
   - Verify connection status shows "Live" with green dot
   - Verify new events appear in real-time (if backend running)
   ```

3. **Polling Fallback**
   ```
   - Disable WebSocket in browser (if possible)
   - Verify polling starts
   - Verify events still update every 5 seconds
   ```

4. **Demo Mode**
   ```
   - Run without backend
   - Verify demo events appear
   - Verify new events every 5 seconds
   - Verify connection shows "Offline"
   ```

5. **Live Stats Updates**
   ```
   - Wait 5 seconds
   - Verify stats counters change
   - Verify progress bar animates
   - Numbers should fluctuate slightly
   ```

## Responsive Tests

### Desktop (>1024px)
- [ ] Sidebar visible on right
- [ ] Feed uses remaining space
- [ ] Stats sticky on scroll

### Tablet (768-1024px)
- [ ] Sidebar moves below feed
- [ ] Feed full width
- [ ] All components readable

### Mobile (<768px)
- [ ] Single column layout
- [ ] Filter buttons wrap
- [ ] Stats stack vertically
- [ ] Touch targets 44px minimum
- [ ] Text remains readable

## Performance Tests

1. **Load Time**
   ```
   - Open DevTools Network tab
   - Hard refresh (Cmd+Shift+R)
   - Verify page loads in < 1s
   - Verify no console errors
   ```

2. **Memory Usage**
   ```
   - Open DevTools Memory tab
   - Take heap snapshot
   - Verify < 50MB for 100 events
   - Let run for 5 minutes
   - Verify no memory leaks (stable usage)
   ```

3. **Animation Performance**
   ```
   - Open DevTools Performance tab
   - Record for 10 seconds
   - Verify 60fps during animations
   - No long tasks (> 50ms)
   ```

## Accessibility Tests

1. **Keyboard Navigation**
   ```
   - Tab through all interactive elements
   - Verify focus indicators visible
   - Verify logical tab order
   - Press Enter on buttons → should activate
   ```

2. **Screen Reader**
   ```
   - Enable VoiceOver (Cmd+F5 on Mac)
   - Navigate page
   - Verify all content announced
   - Verify status updates for live events
   - Verify proper heading hierarchy
   ```

3. **Color Contrast**
   ```
   - Use DevTools Lighthouse
   - Run accessibility audit
   - Verify all text meets WCAG AA (4.5:1)
   - Verify interactive elements meet 3:1
   ```

## Browser Compatibility

Test in:
- [ ] Chrome 90+
- [ ] Firefox 88+
- [ ] Safari 14+
- [ ] Edge 90+

## Common Issues

### Events not appearing
- Check WebSocket URL in .env
- Check browser console for errors
- Verify backend is running
- Check CORS settings

### Copy button not working
- Check clipboard permissions
- Try HTTPS (localhost is OK)
- Check browser console

### Styles not loading
- Clear .next cache: `rm -rf .next`
- Restart dev server
- Check Tailwind config

### TypeScript errors
- Run `npm run type-check`
- Check for missing dependencies
- Verify import paths

## Manual Testing Checklist

```
Landing Page:
□ Hero displays correctly
□ Valuation cards show metrics
□ Code snippet renders
□ Copy button works
□ Live preview shows events
□ Footer links work
□ All animations smooth
□ Responsive on mobile

Live Feed Page:
□ Events display
□ Filtering works
□ Connection status accurate
□ Stats update
□ Timeline scrollable
□ Back button works
□ Responsive layout
□ No console errors

Cross-Browser:
□ Chrome
□ Firefox
□ Safari
□ Edge

Accessibility:
□ Keyboard navigation
□ Screen reader
□ Color contrast
□ Focus indicators
```

## Automated Testing (Future)

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Visual regression
npm run test:visual
```

---

**Status**: Ready for testing
**Last Updated**: 2026-01-31
