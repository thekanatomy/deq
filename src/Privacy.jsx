// Plain answers to "where do my people go?", in Apple's grouped-list style.
// Shown from the menu, and from the "Don't lose your people" sheet.
export default function Privacy() {
  return (
    <div className="privacy">
      <h2 className="menu-title">Privacy</h2>
      <p className="menu-text">
        The people in your deq are yours. Here is exactly where everything goes.
      </p>

      <p className="privacy-head">On this phone</p>
      <ul className="about-group privacy-group">
        <li>
          <b>Your cards live here first</b>
          <span>
            Everyone you add is saved on this phone and works offline. Nothing
            needs an account.
          </span>
        </li>
        <li>
          <b>Your location</b>
          <span>
            Used only to fill in where you met, and saved on that card. Never
            tracked in the background.
          </span>
        </li>
      </ul>

      <p className="privacy-head">When you scan</p>
      <ul className="about-group privacy-group">
        <li>
          <b>Reading a photo</b>
          <span>
            The photo is sent to an AI service (Groq, or Google Gemini as a
            backup) only to read the name and details on it. deq doesn’t keep
            the photo it sends. Google may use free-tier requests to improve its
            models.
          </span>
        </li>
        <li>
          <b>Faces</b>
          <span>
            Finding a face for the avatar happens on this phone. It isn’t sent
            anywhere.
          </span>
        </li>
      </ul>

      <p className="privacy-head">If you sign in</p>
      <ul className="about-group privacy-group">
        <li>
          <b>Backup is your choice</b>
          <span>
            A copy goes to your account so it comes back on a new phone. Only
            your account can read it, and you can switch backup off any time in
            Account.
          </span>
        </li>
      </ul>

      <p className="privacy-head">Never</p>
      <ul className="about-group privacy-group">
        <li>
          <b>No ads, no tracking, no selling</b>
          <span>
            deq doesn’t sell, share or advertise with anything you put in it.
          </span>
        </li>
      </ul>
    </div>
  );
}
