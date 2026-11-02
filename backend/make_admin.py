"""Create an admin account, or promote an existing one.

Usage (from the backend folder):
    python make_admin.py <user_id>             # asks for the password
    python make_admin.py <user_id> <password>
"""
import sys
from getpass import getpass

import bcrypt

from storage import init_db, get_user, create_user, update_password, _conn


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    user_id = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else getpass("Password: ")

    init_db()
    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    if get_user(user_id):
        update_password(user_id, pw_hash)
    else:
        create_user(user_id, user_id, pw_hash)
    with _conn() as c:
        c.execute("UPDATE users SET is_admin=1 WHERE user_id=?", (user_id,))
    print(f"{user_id} is now an admin.")


if __name__ == "__main__":
    main()
