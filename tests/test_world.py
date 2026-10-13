from core.world import create_demo_world


def test_world_clone_is_independent():
    original = create_demo_world()
    cloned = original.clone()

    cloned.contacts[0]["name"] = "Changed Name"

    assert original.contacts[0]["name"] == "Priya Sharma"


def test_demo_world_contains_two_contacts():
    world = create_demo_world()

    assert len(world.contacts) == 2
    assert len(world.calendar) == 1
