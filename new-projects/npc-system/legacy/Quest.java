package dev.velmren.guide;

/** Pure state machine; one engine per player, all transitions on the server thread. */
public final class Quest {
    public enum State { INTRO, COLLECTING, READY, COMPLETE }
    private State state = State.INTRO;
    private int fragments;
    private int rewards;
    public State state() { return state; }
    public int fragments() { return fragments; }
    public int rewards() { return rewards; }
    public String talk() {
        return switch (state) {
            case INTRO -> "I am Rowan, keeper of the beacon. Accept my request to recover three copper fragments.";
            case COLLECTING -> "The beacon needs three fragments. You have " + fragments + ".";
            case READY -> "All three fragments! Claim your emerald and restore the beacon.";
            case COMPLETE -> "The beacon shines again. Your reward has already been claimed.";
        };
    }
    public boolean accept() { if (state != State.INTRO) return false; state = State.COLLECTING; return true; }
    public boolean collect() {
        if (state != State.COLLECTING) return false;
        fragments++;
        if (fragments == 3) state = State.READY;
        return true;
    }
    public boolean claim() {
        if (state != State.READY) return false;
        state = State.COMPLETE; rewards++; return true;
    }
    public void reset() { state = State.INTRO; fragments = 0; rewards = 0; }
}
