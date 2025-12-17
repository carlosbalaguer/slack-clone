# Database Migrations

This project uses `node-pg-migrate` for database schema versioning.

## Commands
```bash
# Run pending migrations
npm run migrate

# Create new migration
npm run migrate:create <migration_name>

# Rollback last migration
npm run migrate:down

# List migrations
npm run migrate:list

# Production
npm run migrate:production
```

## Creating Migrations
```javascript
// migrations/XXX_example.js
exports.up = (pgm) => {
  // Changes to apply
  pgm.addColumn('users', {
    new_field: { type: 'text' }
  });
};

exports.down = (pgm) => {
  // How to rollback
  pgm.dropColumn('users', 'new_field');
};
```

## Best Practices

1. **Always test locally first**
2. **Make migrations reversible** (implement both up and down)
3. **One change per migration** (easier to rollback)
4. **Test rollback** before deploying
5. **Never edit applied migrations**

## Current Schema

- **users**: User accounts with WorkOS auth
- **channels**: Chat channels
- **messages**: Channel messages with FK to users and channels
```