from core.world import seed_world, clone_world


def test_seed_world():
    world = seed_world()
    assert isinstance(world, dict)


def test_clone_world():
    original = seed_world()
    cloned = clone_world(original)
    assert cloned == original
    assert cloned is not original
